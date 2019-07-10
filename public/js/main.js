/* Document URN Array */
urn = [];
urn.push('dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6YW5qYWxlZTAwMS9CaW1UZXN0TW9kZWwubndk');
function getForgeToken(callback) {
    jQuery.ajax({
        url: '/api/forge/oauth/token',
        success: function (res) {
            callback(res.access_token, res.expires_in);
        },
        error: function (err) {
            alert('Failed to get access token. Err: '+ err);
        }
    });
}

var viewerApp;
var options = {
    env: 'AutodeskProduction',
    api: 'derivativeV2',
    getAccessToken: getForgeToken
};
var documentId = 'urn:' + urn[0];
Autodesk.Viewing.Initializer(options, function onInitialized(){
    viewerApp = new Autodesk.Viewing.ViewingApplication('MyViewerDiv');
    var config = {
        //extensions: ['MyAwesomeExtension']
    };
    viewerApp.registerViewer(viewerApp.k3D, Autodesk.Viewing.Private.GuiViewer3D, config);
    //viewerApp.registerViewer(viewerApp.k3D, Autodesk.Viewing.Private.GuiViewer3D);
    viewerApp.loadDocument(documentId, onDocumentLoadSuccess, onDocumentLoadFailure);
});

function onDocumentLoadSuccess(doc) {

    // We could still make use of Document.getSubItemsWithProperties()
    // However, when using a ViewingApplication, we have access to the **bubble** attribute,
    // which references the root node of a graph that wraps each object from the Manifest JSON.
    var viewables = viewerApp.bubble.search({'type':'geometry'});
    if (viewables.length === 0) {
        console.error('Document contains no viewables.');
        return;
    }

    // Choose any of the avialble viewables
    viewerApp.selectItem(viewables[0].data, onItemLoadSuccess, onItemLoadFail);
}

function onDocumentLoadFailure(viewerErrorCode) {
    console.error('onDocumentLoadFailure() - errorCode:' + viewerErrorCode);
}

function onItemLoadSuccess(viewer, item) {
    console.log('onItemLoadSuccess()!');
    console.log(viewer);
    console.log(item);

    // Congratulations! The viewer is now ready to be used.
    console.log('Viewers are equal: ' + (viewer === viewerApp.getCurrentViewer()));

    ///////////////////////////////////////////////////////////////////////////////////////
    console.log("Before setting der: \n\n\n");
    jQuery.ajax({
        url: '/api/forge/modelderivative/manifests/'+urn[0],
        timeout: 1000,
        success: function (res) {
            console.log(" >>>RES= " + JSON.stringify(res));
            const manifest = res;
            const nwVP = manifest.derivatives[0].children[0].children[6];
            console.log("  >>>Derivatives: " + JSON.stringify(manifest));
            console.log("\n  >>>nwVP: " + JSON.stringify(nwVP));

            const camera = nwVP.camera;
            const sectionPlane = nwVP.sectionPlane;
            const nwVPName = nwVP.name;

            const placementWithOffset = viewer.model.getData().placementWithOffset;

            const forge_model_offset = viewer.model.getData().globalOffset;

            const pos = new THREE.Vector3( camera[0], camera[1], camera[2] );
            const target = new THREE.Vector3( camera[3], camera[4], camera[5] );
            const up = new THREE.Vector3( camera[6], camera[7], camera[8] );
            const aspect = camera[9];
            const fov = camera[10] / Math.PI * 180;
            const orthoScale = camera[11];
            const isPerspective = !camera[12];

            const offsetPos = pos.applyMatrix4( placementWithOffset );
            const offsetTarget = target.applyMatrix4( placementWithOffset );

            const nwSavedViewpoints = [];
            nwSavedViewpoints.push(
                {
                    aspect: aspect,
                    isPerspective: isPerspective,
                    fov: fov,
                    position: offsetPos,
                    target: offsetTarget,
                    up: up,
                    orthoScale: orthoScale,
                    name: nwVPName
                });
            //apply the plane to sectioning
            const navis_clip_plane = { x: sectionPlane[0], y: sectionPlane[1], z: sectionPlane[2],d:sectionPlane[3] };

            const dis_in_forge =( forge_model_offset.x * navis_clip_plane.x  +
                forge_model_offset.y * navis_clip_plane.y +
                forge_model_offset.z * navis_clip_plane.z) + navis_clip_plane.d;

            const cutplanes = [
                new THREE.Vector4( navis_clip_plane.x, navis_clip_plane.y, navis_clip_plane.z, dis_in_forge )
            ];


            //set plane and view
            viewer.setCutPlanes( cutplanes )
            viewer.impl.setViewFromCamera( nwSavedViewpoints[0] );
        },
        error: function (err) {
            console.log("\n\t>>>Failed to get deriviates obj. Err: " + JSON.stringify(err));
        }
    });

}

function onItemLoadFail(errorCode) {
    console.error('onItemLoadFail() - errorCode:' + errorCode);
}