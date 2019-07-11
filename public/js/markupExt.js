// MarkupExt.js
function markup3d(viewer, options) {
    Autodesk.Viewing.Extension.call(this, viewer, options);
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.PointCloud.threshold = 5; // hit-test markup size.  Change this if markup 'hover' doesn't work
    this.size = 150.0; // markup size.  Change this if markup size is too big or small
    this.lineColor = 0xcccccc; // off-white
    this.labelOffset = new THREE.Vector3(120,120,0);  // label offset 3D line offset position
    this.xDivOffset = -0.2;  // x offset position of the div label wrt 3D line.
    this.yDivOffset = 0.4;  // y offset position of the div label wrt 3D line.

    this.scene = viewer.impl.scene; // change this to viewer.impl.sceneAfter with transparency, if you want the markup always on top.
    this.markupItems = []; // array containing markup data
    this.pointCloud; // three js point-cloud mesh object
    this.line3d; // three js point-cloud mesh object
    this.camera = viewer.impl.camera;
    this.hovered; // index of selected pointCloud id, based on markupItems array
    this.selected; // index of selected pointCloud id, based on markupItems array
    this.label; // x,y div position of selected pointCloud. updated on mouse-move
    this.offset; // global offset

    this.vertexShader = `
        uniform float size;
        varying vec3 vColor;
        void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
            gl_PointSize = size * ( size / (length(mvPosition.xyz) + 1.0) );
            gl_Position = projectionMatrix * mvPosition;
        }
    `

    this.fragmentShader = `
        uniform sampler2D tex;
        varying vec3 vColor;
        void main() {
            gl_FragColor = vec4( vColor.x, vColor.x, vColor.x, 1.0 );
            gl_FragColor = gl_FragColor * texture2D(tex, vec2((gl_PointCoord.x+vColor.y*1.0)/4.0, 1.0-gl_PointCoord.y));
            if (gl_FragColor.w < 0.5) discard;
        }
    `

}

markup3d.prototype = Object.create(Autodesk.Viewing.Extension.prototype);
markup3d.prototype.constructor = markup3d;

markup3d.prototype.updateHitTest = function(event, viewer) {
    // on mouse move event, check if ray hit with pointcloud, move selection cursor
    // https://stackoverflow.com/questions/28209645/raycasting-involving-individual-points-in-a-three-js-pointcloud
    if (!this.pointCloud) return;
    var x = (event.clientX / window.innerWidth) * 2 - 1;
    var y = -(event.clientY / window.innerHeight) * 2 + 1;
    var vector = new THREE.Vector3(x, y, 0.5).unproject(this.camera);
    this.raycaster.set(this.camera.position, vector.sub(this.camera.position).normalize());
    var nodes = this.raycaster.intersectObject(this.pointCloud);
    if (nodes.length > 0) {
        if (this.hovered)
            this.geometry.colors[this.hovered].r = 1.0;
        this.hovered = nodes[0].index;
        this.geometry.colors[this.hovered].r = 2.0;
        this.geometry.colorsNeedUpdate = true;
        viewer.impl.invalidate(true);
    }
}

markup3d.prototype.unload = function() {
    return true;
};

markup3d.prototype.load = function() {
    var self = this;
    let viewer = this.viewer;
    console.log('EXTENSION DUMP \n\t');
    console.log(viewer);
    console.log(viewer.model);

    // The init functions need to read info from the model, so we must wait for it to be loaded before running them
    viewer.addEventListener(Autodesk.Viewing.MODEL_ROOT_LOADED_EVENT, function() {
        console.log('extension model loading')
        // setup listeners for new data and mouse events
        window.addEventListener("newData", e => { self.setMarkupData( e.detail ) }, false);
        document.addEventListener('click', e => { self.onClick(e) }, false);
        document.addEventListener('mousemove', e => { self.onMouseMove(e) }, false);
        document.addEventListener('touchend', e => { self.onClickTouch(e) }, false);
        document.addEventListener('mousewheel', e => { self.onMouseMove(e) }, true);

        self.offset = viewer.model.getData().globalOffset; // use global offset to align pointCloud with lmv scene

        // Load markup points into Point Cloud
        self.setMarkupData = function (data) {
            self.markupItems = data;
            self.geometry = new THREE.Geometry();
            data.map(item => {
                point = (new THREE.Vector3(item.x, item.y, item.z));
                self.geometry.vertices.push(point);
                self.geometry.colors.push(new THREE.Color(1.0, item.icon, 0)); // icon = 0..2 position in the horizontal icons.png sprite sheet
            });
            self.initMesh_PointCloud();
            self.initMesh_Line();
        };


        self.initMesh_PointCloud = function () {
            if (self.pointCloud)
                self.scene.remove(self.pointCloud); //replace existing pointCloud Mesh
            else {
                // create new point cloud material
                var texture = THREE.ImageUtils.loadTexture("http://localhost:3000/icons.png");
                var material = new THREE.ShaderMaterial({
                    vertexColors: THREE.VertexColors,
                    fragmentShader: self.fragmentShader,
                    vertexShader: self.vertexShader,
                    depthWrite: true,
                    depthTest: true,
                    uniforms: {
                        size: {type: "f", value: self.size},
                        tex: {type: "t", value: texture}
                    }
                });
            }
            self.pointCloud = new THREE.PointCloud(self.geometry, material);
            self.pointCloud.position.sub(self.offset);
            self.scene.add(self.pointCloud);
        }


        self.initMesh_Line = function () {
            var geom = new THREE.Geometry();
            geom.vertices.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1),);
            self.line3d = new THREE.Line(geom, new THREE.LineBasicMaterial({color: self.lineColor, linewidth: 4.0,}));
            self.line3d.position.sub(self.offset);
            self.scene.add(self.line3d);
        }

        self.update_Line = function () {
            var position = self.pointCloud.geometry.vertices[self.selected].clone();
            self.line3d.geometry.vertices[0] = position;
            self.line3d.geometry.vertices[1].set(position.x + self.labelOffset.x * Math.sign(position.x), position.y + self.labelOffset.y, position.z + self.labelOffset.z);
            self.line3d.geometry.verticesNeedUpdate = true;
        }

        self.update_DivLabel = function (eventName) {
            var position = self.line3d.geometry.vertices[1].clone().sub(self.offset);
            self.label = position.project(self.camera);
            window.dispatchEvent(new CustomEvent(eventName, {
                'detail': {
                    id: self.selected,
                    x: self.label.x + self.xDivOffset,
                    y: self.label.y + self.yDivOffset,
                }
            }));
        }

        // Dispatch Message when a point is clicked
        self.onMouseMove = function(event) {
            self.update_DivLabel('onMarkupMove');
            self.updateHitTest(event, viewer);
        }


        self.onClick = function() {
            if (!self.hovered) return;
            self.selected = self.hovered;
            self.update_Line();
            self.update_DivLabel('onMarkupClick');
            viewer.impl.invalidate(true);
            viewer.clearSelection();
        }


        self.onClickTouch = function(t) {
            self.updateHitTest(t.changedTouches[0]);
            onDocumentMouseClick();
        }

        initializeMarkup();
    });

    return true;
};

function initializeMarkup(){
    const elem = $("#label");
    console.log("\n\t>>> label");
    console.log(elem);
    // create 20 random markup points
    // where icon is 0="Issue", 1="BIMIQ_Warning", 2="RFI", 3="BIMIQ_Hazard"
    var dummyData = [];
    for (let i=0; i<20; i++) {
        dummyData.push({
            icon:  Math.round(Math.random()*3),
            x: Math.random()*300-150,
            y: Math.random()*50-20,
            z: Math.random()*150-130
        });
    }
    window.dispatchEvent(new CustomEvent('newData', {'detail': dummyData}));

    function moveLabel(p) {
        elem.style.left = ((p.x + 1)/2 * window.innerWidth) + 'px';
        elem.style.top =  (-(p.y - 1)/2 * window.innerHeight) + 'px';
    }
    // listen for the 'Markup' event, to re-position our <DIV> POPUP box
    window.addEventListener("onMarkupMove", e=>{moveLabel(e.detail)}, false)
    window.addEventListener("onMarkupClick", e=>{
        elem.style.display = "block";
        moveLabel(e.detail);
        elem.innerHTML = `<img src="img/${(e.detail.id%6)}.jpg"><br>Markup ID:${e.detail.id}`;
    }, false);
}




Autodesk.Viewing.theExtensionManager.registerExtension('markup3d', markup3d);