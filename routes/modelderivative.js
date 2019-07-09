/////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
// Written by Forge Partner Development
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////

const express = require('express');
const config = require('../config');
const {
    DerivativesApi,
    JobPayload,
    JobPayloadInput,
    JobPayloadOutput,
    JobSvfOutputPayload
} = require('forge-apis');

const { getClient, getPublicToken, getInternalToken } = require('./common/oauth');

let router = express.Router();

// Middleware for obtaining a token for each request.
router.use(async (req, res, next) => {
    const token = await getPublicToken();
    req.oauth_token = token;
    req.oauth_client = getClient(config.scopes.public);
    next();
});

// POST /api/forge/modelderivative/jobs - submits a new translation job for given object URN.
// Request body must be a valid JSON in the form of { "objectName": "<translated-object-urn>" }.
router.post('/jobs', async (req, res, next) => {
    let job = new JobPayload();
    job.input = new JobPayloadInput();
    job.input.urn = req.body.objectName;
    job.output = new JobPayloadOutput([
        new JobSvfOutputPayload()
    ]);
    job.output.formats[0].type = 'svf';
    job.output.formats[0].views = ['2d', '3d'];
    try {
        // Submit a translation job using [DerivativesApi](https://github.com/Autodesk-Forge/forge-api-nodejs-client/blob/master/docs/DerivativesApi.md#translate).
        await new DerivativesApi().translate(job, {}, req.oauth_client, req.oauth_token);
        res.status(200).end();
    } catch(err) {
        next(err);
    }
});

// GET /api/forge/modelderivative/derivatives
router.get('/derivatives', (req, res, next ) => {
    try {
        const urnLiteral = 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6YW5qYWxlZTAwMS9CaW1UZXN0TW9kZWwubndk';
        const manifestString = new DerivativesApi.getManifest(urnLiteral, {}, req.oauth_client, req.oauth_token);
        /*console.log("\n>>>manifestStr: " + manifestString);
        const manifest = JSON.parse(manifestString);
        const derivatives = manifest.derivatives;
         */
        res.send(manifestString);
    } catch (err) {
        next(err);
        console.error("ANJ > GET /api/forge/modelderivative/derivatives failed");
    }

});

/////////////////////////////////////////////////////////////////
// Get the manifest of the given file. This will contain
// information about the various formats which are currently
// available for this file
/////////////////////////////////////////////////////////////////
router.get('/manifests/:urn', function (req, res) {
    const derivatives = new DerivativesApi();

    // derivatives.getManifest(req.params.urn, {}, req.oauth_client, req.oauth_token)
    const urnLiteral = 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6YW5qYWxlZTAwMS9CaW1UZXN0TW9kZWwubndk';
    derivatives.getManifest(req.params.urn, {}, req.oauth_client, req.oauth_token)
        .then(function (data) {
            res.json(data.body);
        })
        .catch(function (error) {
            res.status(error.statusCode).end(error.statusMessage);
        });
});

module.exports = router;
