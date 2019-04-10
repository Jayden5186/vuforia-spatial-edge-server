﻿/**
 *   Created by Carsten on 12/06/2015.
 *   Modified by Valentin Heun on 16/08/16.
 **
 *   Copyright (c) 2015 Carsten Strunk
 *
 *   This Source Code Form is subject to the terms of the Mozilla Public
 *   License, v. 2.0. If a copy of the MPL was not distributed with this
 *   file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * Reality Objecst Hardware Interface API
 * 
 * This API is intended for users who want to create their own hardware interfaces.
 * To create a new hardware interface create a folder under hardwareInterfaces and create the file index.js.
 * You should take a look at /hardwareInterfaces/emptyExample/index.js to get started.
 */

var http = require('http');
var utilities = require(__dirname + '/utilities');
var _ = require('lodash');

//global variables, passed through from server.js
var objects = {};
var objectLookup;
var globalVariables;
var dirnameO;
var objectsPath;
var nodeTypeModules;
var blockModules;
var callback;
var Node;
var actionCallback;
var publicDataCallBack;
var writeObjectCallback;
var hardwareObjects = {};
var callBacks = new Objects();
var screenObjectCallBacks = {};
var frameAddedCallbacks = [];
var resetCallbacks = [];
var matrixStreamCallbacks = [];
var udpMessageCallbacks = [];
var screenPortMap = {};
var _this = this;

//data structures to manage the IO points generated by the API user
function Objects() {
    this.resetCallBacks = [];
    this.shutdownCallBacks = [];
}

function EmptyObject(objectName) {
    this.name = objectName;
    this.frames = {};
}

function EmptyFrame(frameName) {
    this.name = frameName;
    this.nodes = {};
}

function EmptyNode(nodeName, type) {
    this.name = nodeName;
    this.type = type;
    this.callBack = {};
}

function Frame() {
    // The ID for the object will be broadcasted along with the IP. It consists of the name with a 12 letter UUID added.
    this.objectId = null;
    // The name for the object used for interfaces.
    this.name = "";
    // which visualization mode it should use right now ("ar" or "screen")
    this.visualization = "ar";
    // position data for the ar visualization mode
    this.ar = {
        // Reality Editor: This is used to position the UI element within its x axis in 3D Space. Relative to Marker origin.
        x : 0,
        // Reality Editor: This is used to position the UI element within its y axis in 3D Space. Relative to Marker origin.
        y : 0,
        // Reality Editor: This is used to scale the UI element in 3D Space. Default scale is 1.
        scale : 1,
        // Unconstrained positioning in 3D space
        matrix : []
    };
    // position data for the screen visualization mode
    this.screen = {
        // Reality Editor: This is used to position the UI element within its x axis in 3D Space. Relative to Marker origin.
        x : 0,
        // Reality Editor: This is used to position the UI element within its y axis in 3D Space. Relative to Marker origin.
        y : 0,
        // Reality Editor: This is used to scale the UI element in 3D Space. Default scale is 1.
        scale : 1
    };
    // Used internally from the reality editor to indicate if an object should be rendered or not.
    this.visible = false;
    // Used internally from the reality editor to trigger the visibility of naming UI elements.
    this.visibleText = false;
    // Used internally from the reality editor to indicate the editing status.
    this.visibleEditing = false;
    // every object holds the developer mode variable. It indicates if an object is editable in the Reality Editor.
    this.developer = true;
    // Stores all the links that emerge from within the object. If a IOPoint has new data,
    // the server looks through the Links to find if the data has influence on other IOPoints or Objects.
    this.links = {};
    // Stores all IOPoints. These points are used to keep the state of an object and process its data.
    this.nodes = {};
    // local or global. If local, node-name is exposed to hardware interface
    this.location = "local";
    // source
    this.src = "editor";
}


/*
 ********** API FUNCTIONS *********
 */

/**
 * @desc This function writes the values passed from the hardware interface to the RealityObjects server.
 * @param {string} objectName The name of the RealityInterface
 * @param {string} nodeName The name of the IO point
 * @param {value} value The value to be passed on
 * @param {string} mode specifies the datatype of value, you can define it to be whatever you want. For example 'f' could mean value is a floating point variable.
 **/
exports.getIP = function () {
    var ip = require("ip");
    return ip.address();
}

exports.write = function (objectName, frameName, nodeName, value, mode, unit, unitMin, unitMax) {

    if (typeof mode === 'undefined')  mode = "f";
    if (typeof unit === 'undefined')  unit = false;
    if (typeof unitMin === 'undefined')  unitMin = 0;
    if (typeof unitMax === 'undefined')  unitMax = 1;

    var objectKey = utilities.readObject(objectLookup, objectName); //get globally unique object id
    //  var valueKey = nodeName + objKey2;

    var nodeUuid = objectKey+frameName+nodeName;
    var frameUuid = objectKey+frameName;
    //console.log(objectLookup);
//    console.log("writeIOToServer obj: "+objectName + "  name: "+nodeName+ "  value: "+value+ "  mode: "+mode);
    if (objects.hasOwnProperty(objectKey)) {
        if (objects[objectKey].frames.hasOwnProperty(frameUuid)) {
            if (objects[objectKey].frames[frameUuid].nodes.hasOwnProperty(nodeUuid)) {
                var thisData = objects[objectKey].frames[frameUuid].nodes[nodeUuid].data;
                thisData.value = value;
                thisData.mode = mode;
                thisData.unit = unit;
                thisData.unitMin = unitMin;
                thisData.unitMax = unitMax;
                //callback is objectEngine in server.js. Notify data has changed.
                callback(objectKey, frameUuid, nodeUuid, thisData, objects, nodeTypeModules);
            }
        }
    }
};

exports.writePublicData = function (objectName, frameName, nodeName, dataObject, data) {
    var objectKey = utilities.readObject(objectLookup, objectName); //get globally unique object id
    var nodeUuid = objectKey+frameName+nodeName;
    var frameUuid = objectKey+frameName;
    //console.log(objectLookup);
//    console.log("writeIOToServer obj: "+objectName + "  name: "+nodeName+ "  value: "+value+ "  mode: "+mode);
    if (objects.hasOwnProperty(objectKey)) {
        if (objects[objectKey].frames.hasOwnProperty(frameUuid)) {
            if (objects[objectKey].frames[frameUuid].nodes.hasOwnProperty(nodeUuid)) {
                var thisData = objects[objectKey].frames[frameUuid].nodes[nodeUuid].publicData;
                thisData[dataObject] = data;
                //callback is objectEngine in server.js. Notify data has changed.
                  publicDataCallBack(objectKey, frameUuid, nodeUuid);
            }
        }
    }
};

/**
 * @desc clearIO() removes IO points which are no longer needed. It should be called in your hardware interface after all addIO() calls have finished.
 * @param {string} type The name of your hardware interface (i.e. what you put in the type parameter of addIO())
 **/
exports.clearObject = function (objectId, frameID) {
    var objectID = utilities.getObjectIdFromTarget(objectId, objectsPath);
    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {
        for (var key in objects[objectID].frames[objectID].nodes) {
            if (!hardwareObjects[objectId].nodes.hasOwnProperty(key)) {
                cout("Deleting: " + objectID + "   "+ objectID + "   " + key);
                delete objects[objectID].frames[frameID].nodes[key];
            }
        }
    }
    //TODO: clear links too
    cout("object is all cleared");
};

exports.removeAllNodes = function (objectName, frameName) {
    var objectID = utilities.getObjectIdFromTarget(objectName, objectsPath);
    var frameID = objectID + frameName;
    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {
        if (objects.hasOwnProperty(objectID)) {
            if (objects[objectID].frames.hasOwnProperty(frameID)) {
                console.log("object+frame exists");
                for (var nodeKey in objects[objectID].frames[frameID].nodes) {
                    if (!objects[objectID].frames[frameID].nodes.hasOwnProperty(nodeKey)) continue;
                    delete objects[objectID].frames[frameID].nodes[nodeKey];
                }
            }
        }
    }
};

exports.removeNode = function (objectName, frameName, nodeName) {
    var objectID = utilities.getObjectIdFromTarget(objectName, objectsPath);
    var frameID = objectID + frameName;
    var nodeID = objectID + frameName + nodeName;
    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {
        if (objects.hasOwnProperty(objectID)) {
            if (objects[objectID].hasOwnProperty(frameID)) {
                if (objects[objectID].frames[frameID].nodes.hasOwnProperty(nodeID)) {
                    console.log("deleting node " + thisNode);
                    delete objects[objectID].frames[frameID].nodes[nodeID];
                }
            }
        }
    }
};

exports.reloadNodeUI = function (objectName) {
    var objectID = utilities.getObjectIdFromTarget(objectName, objectsPath);
    actionCallback({reloadObject: {object: objectID}});
    writeObjectCallback(objectID);
};

exports.getAllFrames = function (objectName) {
    var objectID = utilities.readObject(objectLookup, objectName);
    // var objectID = utilities.getObjectIdFromTarget(objectName, objectsPath);
    console.log(objectID);
    // lookup object properties using name
    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {
        if (objects.hasOwnProperty(objectID)) {
            var frames = objects[objectID].frames;
            return frames;
        }
    }

    return {};
};

exports.getAllNodes = function (objectName, frameName) {
    var objectID = utilities.getObjectIdFromTarget(objectName, objectsPath);
    var frameID = objectID + frameName;

    // lookup object properties using name
    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {
        if (objects.hasOwnProperty(objectID)) {
            if (objects[objectID].frames.hasOwnProperty(frameID)) {
                // get all of its nodes
                var nodes = objects[objectID].frames[frameID].nodes;
                // return node list
                return nodes;
            }
        }
    }

    return {};
};

exports.getAllLinksToNodes = function (objectName, frameName) {
    var objectID = utilities.getObjectIdFromTarget(objectName, objectsPath);
    var frameID = objectID + frameName;

    // lookup object properties using name
    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {
        if (objects.hasOwnProperty(objectID)) {
            if (objects[objectID].frames.hasOwnProperty(frameID)) {
                // get all of its nodes
                var links = objects[objectID].frames[frameID].links;
                // return node list
                return links; // TODO: this isn't complete. need to search for links in all objects that have this destination
            }
        }
    }

    return {};
};

exports.subscribeToNewFramesAdded = function (objectName, callback) {
    console.log('subscribeToNewFramesAdded');
    var objectID = utilities.readObject(objectLookup, objectName);

    frameAddedCallbacks.push({
        objectID: objectID,
        callback: callback
    });
};

exports.runFrameAddedCallbacks = function(objectKey, thisFrame) {
    console.log('runFrameAddedCallbacks for object ' + objectKey);
    frameAddedCallbacks.forEach(function(callbackObject) {
        if (callbackObject.objectID === objectKey) {
            console.log('found a callback');
            callbackObject.callback(thisFrame);
        }
    });
};

exports.subscribeToReset = function (objectName, callback) {
    console.log('subscribeToNewFramesAdded');
    var objectID = utilities.readObject(objectLookup, objectName);

    resetCallbacks.push({
        objectID: objectID,
        callback: callback
    });
};

exports.runResetCallbacks = function(objectKey) {
    console.log('runResetCallbacks for object ' + objectKey);
    resetCallbacks.forEach(function(callbackObject) {
        if (callbackObject.objectID === objectKey) {
            console.log('found a callback');
            callbackObject.callback();
        }
    });
};

exports.subscribeToMatrixStream = function(callback) {
    matrixStreamCallbacks.push(callback);
};

exports.triggerMatrixCallbacks = function(visibleObjects) {
    matrixStreamCallbacks.forEach(function(callback) {
        callback(visibleObjects);
    });
};

exports.subscribeToUDPMessages = function(callback) {
    udpMessageCallbacks.push(callback);
};

exports.triggerUDPCallbacks = function(msgContent) {
    udpMessageCallbacks.forEach(function(callback) {
        callback(msgContent);
    });
};

/**
 * @desc addIO() a new IO point to the specified RealityInterface
 * @param {string} objectName The name of the RealityInterface
 *  * @param {string} frameName The name of the RealityInterface frame
 * @param {string} nodeName The name of the nodeName
 * @param {string} type The name of the data conversion type. If you don't have your own put in "default".
 * @param {object} position - an optional {x: float, y: float} object for the node's starting position. otherwise random
 **/

exports.addNode = function (objectName, frameName, nodeName, type, position) {

    var objectID = utilities.getObjectIdFromTarget(objectName, objectsPath);
    cout("AddIO objectID: " + objectID);

    var nodeUuid = objectID+frameName+nodeName;
    var frameUuid = objectID+frameName;

    //objID = nodeName + objectID;

    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {

        cout("I will save: " + objectName + " and " + nodeName + " for frame " + frameName);

        if (objects.hasOwnProperty(objectID)) {
            objects[objectID].developer = globalVariables.developer;
            objects[objectID].name = objectName;

            if (!objects[objectID].frames.hasOwnProperty(frameUuid)) {
                objects[objectID].frames[frameUuid] = new Frame();
                utilities.createFrameFolder(objectName, frameName, dirnameO, objectsPath, globalVariables.debug, "local");
            } else {
                utilities.createFrameFolder(objectName, frameName, dirnameO, objectsPath, globalVariables.debug, objects[objectID].frames[frameUuid].location);
            }
            if (!objects[objectID].frames[frameUuid].hasOwnProperty("nodes")) {
                objects[objectID].frames[frameUuid].nodes = {};
            }

            objects[objectID].frames[frameUuid].name = frameName;
            objects[objectID].frames[frameUuid].objectId = objectID;

            var thisObject;

            if (!objects[objectID].frames[frameUuid].nodes.hasOwnProperty(nodeUuid)) {
                objects[objectID].frames[frameUuid].nodes[nodeUuid] = new Node();
                thisObject = objects[objectID].frames[frameUuid].nodes[nodeUuid];
                thisObject.x = utilities.randomIntInc(0, 200) - 100;
                thisObject.y = utilities.randomIntInc(0, 200) - 100;
                if (position) {
                    if (position.x !== undefined) thisObject.x = position.x;
                    if (position.y !== undefined) thisObject.y = position.y;
                }
                thisObject.frameSizeX = 100;
                thisObject.frameSizeY = 100;
            }

            thisObject = objects[objectID].frames[frameUuid].nodes[nodeUuid];
            thisObject.name = nodeName;
            thisObject.frameId = frameUuid;
            thisObject.objectId = objectID;
            thisObject.text = undefined;
            thisObject.type = type;

            //console.log('set new node name to ' + thisObject.name);
            //console.log(objects[objectID].frames[frameUuid].nodes[nodeUuid]);

            if (!hardwareObjects.hasOwnProperty(objectName)) {
                hardwareObjects[objectName] = new EmptyObject(objectName);
            }

            if (!hardwareObjects[objectName].frames.hasOwnProperty(frameUuid)) {
                hardwareObjects[objectName].frames[frameUuid] = new EmptyFrame(frameName);
            }

            if (!hardwareObjects[objectName].frames[frameUuid].nodes.hasOwnProperty(nodeUuid)) {
                hardwareObjects[objectName].frames[frameUuid].nodes[nodeUuid] = new EmptyNode(nodeName);
                hardwareObjects[objectName].frames[frameUuid].nodes[nodeUuid].type = type;
            }
        }
    }
};

exports.renameNode = function (objectName, frameName, oldNodeName, newNodeName) {
    var objectID = utilities.getObjectIdFromTarget(objectName, objectsPath);
    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {
        if (objects.hasOwnProperty(objectID)) {
            var frameUUID = objectID + frameName;
            var nodeUUID = objectID + frameName + oldNodeName;

            if(nodeUUID in objects[objectID].frames[frameUUID].nodes){
                objects[objectID].frames[frameUUID].nodes[nodeUUID].text = newNodeName;
               // return
            } /*else {
                for (var key in objects[objectID].nodes) {
                    if (objects[objectID].nodes[key].name === oldNodeName) {
                        objects[objectID].nodes[key].name = newNodeName;
                        return;
                    }
                }
            }*/
        }
    }
    actionCallback({reloadObject: {object: objectID, frame: frameUUID}});
    objectID = undefined;
};

exports.moveNode = function (objectName, frameName, nodeName, x, y) {
    var objectID = utilities.getObjectIdFromTarget(objectName, objectsPath);
    var frameID = objectID + frameName;
    var nodeID = objectID + frameName + nodeName;

    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {
        if (objects.hasOwnProperty(objectID)) {
            if (objects[objectID].frames.hasOwnProperty(frameID)) {
                if (objects[objectID].frames[frameID].nodes.hasOwnProperty(nodeID)) {
                    objects[objectID].frames[frameID].nodes[nodeID].x = x;
                    objects[objectID].frames[frameID].nodes[nodeID].y = y;
                    console.log("moved node " + nodeName + " to (" + x + ", " + y + ")");
                }
            }
        }
    }
};

exports.activate = function (objectName) {
    var objectID = utilities.getObjectIdFromTarget(objectName, objectsPath);
    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {
        if (objects.hasOwnProperty(objectID)) {
            objects[objectID].deactivated = false;
        }
    }
};

exports.deactivate = function (objectName) {
    var objectID = utilities.getObjectIdFromTarget(objectName, objectsPath);
    console.log("--------- deactive---------")
    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {
        if (objects.hasOwnProperty(objectID)) {
            objects[objectID].deactivated = true;

        }
    }
};




exports.getObjectIdFromObjectName = function (objectName) {
    return utilities.getObjectIdFromTarget(objectName, objectsPath);
};

exports.getMarkerSize = function(objectName) {
    var objectID = utilities.getObjectIdFromTarget(objectName, objectsPath);
    return objects[objectID].targetSize;
};

/**
 * @desc developerOn() Enables the developer mode for all RealityInterfaces and enables the developer web interface
 **/
exports.enableDeveloperUI = function (developer) {
    globalVariables.developer = developer;
    for (var objectID in objects) {
        objects[objectID].developer = developer;
    }
};

/**
 * @desc getDebug() checks if debug mode is turned on
 * @return {boolean} true if debug mode is on, false otherwise
 **/
exports.getDebug = function () {
    return globalVariables.debug;
};

/*
 ********** END API FUNCTIONS *********
 */

/**
 * @desc setup() DO NOT call this in your hardware interface. setup() is only called from server.js to pass through some global variables.
 **/
exports.setup = function (objExp, objLookup, glblVars, dir, objPath, types, blocks, objValue, callbacks) {
    objects = objExp;
    objectLookup = objLookup;
    globalVariables = glblVars;
    dirnameO = dir;
    objectsPath = objPath;
    nodeTypeModules = types;
    blockModules = blocks;
    Node = objValue;
    publicDataCallBack = callbacks.publicData;
    actionCallback = callbacks.actions;
    callback = callbacks.data;
    writeObjectCallback = callbacks.write;

};

exports.reset = function (){
    for (var objectKey in objects) {
        for (var frameKey in objects[objectKey].frames) {
            var frame = objects[objectKey].frames[frameKey];
            for (var nodeKey in frame.nodes) {
                var node = frame.nodes[nodeKey];
                if (node.type === "logic" || node.frame) {
                    continue;
                }
                // addNode requires that nodeKey === object.name + node.name
                _this.addNode(objects[objectKey].name, frame.name, node.name, node.type);
            }
            _this.clearObject(objectKey);
        }
    }

    cout("sendReset");
    for (var i = 0; i < callBacks.resetCallBacks.length; i++) {
        callBacks.resetCallBacks[i]();
    }
};

exports.readCall = function (objectID, frameID, nodeID, data) {
    if (callBacks.hasOwnProperty(objectID)) {
        if (callBacks[objectID].frames.hasOwnProperty(frameID)) {
            if (callBacks[objectID].frames[frameID].nodes.hasOwnProperty(nodeID)) {
                if (callBacks[objectID].frames[frameID].nodes[nodeID].hasOwnProperty("callBack")) {
                    callBacks[objectID].frames[frameID].nodes[nodeID].callBack(data);
                }
            }
        }
    }
};

exports.readPublicDataCall = function (objectID, frameID, nodeID,data) {
    if (callBacks.hasOwnProperty(objectID)) {
        if (callBacks[objectID].frames.hasOwnProperty(frameID)) {
            if (callBacks[objectID].frames[frameID].nodes.hasOwnProperty(nodeID)) {
                if(callBacks[objectID].frames[frameID].nodes[nodeID].hasOwnProperty("publicCallBacks")){
                    var allCallbacks = callBacks[objectID].frames[frameID].nodes[nodeID].publicCallBacks;
                    allCallbacks.forEach(function(thisCB) {
                        if(data.hasOwnProperty(thisCB.dataObject)) {
                            thisCB.cb(data[thisCB.dataObject]);
                        }
                    });
                }
            }
        }
    }
};

exports.screenObjectCall = function (data) {
    for(var key in screenObjectCallBacks){
        screenObjectCallBacks[key](data);
    }
};

var screenObjectServerCallBackObject = function (x,y,z,a,b) {};
exports.screenObjectServerCallBack = function (callback) {
    screenObjectServerCallBackObject = callback;
};

// TODO These are the two calls for the page
exports.addScreenObjectListener = function (objectName, callBack) {
    var objectID = utilities.readObject(objectLookup, objectName);
    if (!_.isUndefined(objectID)) {
            screenObjectCallBacks[objectID] = callBack;
    }
};

exports.writeScreenObjects = function (object, frame, node, touchOffsetX, touchOffsetY) {
    if(!object) object = null;
    if(!frame) frame = null;
    if(!node || node === "null") node = null;

    var objectKey = utilities.readObject(objectLookup, object); //get globally unique object id
    if(objectKey) object = objectKey;
    if(node && !node.includes(object)) node = object+frame+node;
    if(frame && !frame.includes(object)) frame = object+frame;

    screenObjectServerCallBackObject(object, frame, node, touchOffsetX, touchOffsetY);
};

exports.activateScreen = function (objectName, port) {
    var objectID = utilities.readObject(objectLookup, objectName);
    screenPortMap[objectID] = port;
};

exports.getScreenPort = function (objectID) {
    return screenPortMap[objectID];
};

exports.addReadListener = function (objectName, frameName, nodeName, callBack) {
    var objectID = utilities.readObject(objectLookup, objectName);
    var nodeID = objectID+frameName+nodeName;
    var frameID = objectID+frameName;

    cout("Add read listener for objectID: " + objectID);

    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {

        if (objects.hasOwnProperty(objectID)) {
            if (objects[objectID].frames.hasOwnProperty(frameID)) {

                if (!callBacks.hasOwnProperty(objectID)) {
                    callBacks[objectID] = new EmptyObject(objectID);
                }

                if (!callBacks[objectID].frames.hasOwnProperty(frameID)) {
                    callBacks[objectID].frames[frameID] = new EmptyFrame(frameName);
                }

                if (!callBacks[objectID].frames[frameID].nodes.hasOwnProperty(nodeID)) {
                    callBacks[objectID].frames[frameID].nodes[nodeID] = new EmptyNode(nodeName);
                }

                callBacks[objectID].frames[frameID].nodes[nodeID].callBack = callBack;

            }
        }
    }
};


exports.addPublicDataListener = function (objectName, frameName, nodeName, dataObject, callBack) {
    var objectID = utilities.readObject(objectLookup, objectName);
    var nodeID = objectID+frameName+nodeName;
    var frameID = objectID+frameName;

    cout("Add publicData listener for objectID: " + objectID);

    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {

        if (objects.hasOwnProperty(objectID)) {
            if (objects[objectID].frames.hasOwnProperty(frameID)) {

                if (!callBacks.hasOwnProperty(objectID)) {
                    callBacks[objectID] = new EmptyObject(objectID);
                }

                if (!callBacks[objectID].frames.hasOwnProperty(frameID)) {
                    callBacks[objectID].frames[frameID] = new EmptyFrame(frameName);
                }

                if (!callBacks[objectID].frames[frameID].nodes.hasOwnProperty(nodeID)) {
                    callBacks[objectID].frames[frameID].nodes[nodeID] = new EmptyNode(nodeName);
                }

                if (typeof callBacks[objectID].frames[frameID].nodes[nodeID].publicCallBacks === 'undefined') {
                    callBacks[objectID].frames[frameID].nodes[nodeID].publicCallBacks = [];
                }

                callBacks[objectID].frames[frameID].nodes[nodeID].publicCallBacks.push( {cb:callBack, dataObject:dataObject} );
            }
        }
    }
};

exports.connectCall = function (objectID, frameID, nodeID, data) {
    console.log('\ncallBacks...\n');
    // console.log(callBacks);
    // var prettyprintCallbacks = {};
    {
        for (var c in callBacks) {
            if (callBacks[c].hasOwnProperty('frames')) {
                // prettyprintCallbacks[c] = callBacks[c].frames;
                for (var f in callBacks[c].frames) {
                   // console.log(callBacks[c].frames[f].nodes);
                }
            }
        }
    }
    // console.log(prettyprintCallbacks);
   // console.log('\n');
    if (callBacks.hasOwnProperty(objectID)) {
        if (callBacks[objectID].frames.hasOwnProperty(frameID)) {
            if (callBacks[objectID].frames[frameID].nodes.hasOwnProperty(nodeID)) {
              //  console.log(callBacks[objectID].frames[frameID].nodes[nodeID]);
                if (typeof callBacks[objectID].frames[frameID].nodes[nodeID].connectionCallBack === 'function') {
                    callBacks[objectID].frames[frameID].nodes[nodeID].connectionCallBack(data);
                    console.log("connection callback called");
                } else {
                    console.log("no connection callback");
                }
            }
        }
    }
};

exports.addConnectionListener = function (objectName, frameName, nodeName, callBack) {
    var objectID = utilities.readObject(objectLookup, objectName);
    var frameID = objectID + frameName;
    var nodeID = objectID + frameName + nodeName;

    cout("Add connection listener for objectID: " + objectID + ", " + frameID + ", " + nodeName);

    if (!_.isUndefined(objectID) && !_.isNull(objectID)) {

        if (objects.hasOwnProperty(objectID)) {

            if (!callBacks.hasOwnProperty(objectID)) {
                callBacks[objectID] = new EmptyObject(objectID);
            }

            var callbackObject = callBacks[objectID];

            if (!callBacks[objectID].frames.hasOwnProperty(frameID)) {
                callBacks[objectID].frames[frameID] = new EmptyFrame(frameName);
            }

            if (!callBacks[objectID].frames[frameID].nodes.hasOwnProperty(nodeID)) {
                callBacks[objectID].frames[frameID].nodes[nodeID] = new EmptyNode(nodeName);
            }

          //  console.log(callBacks[objectID].frames[frameID].nodes[nodeID]);

            callBacks[objectID].frames[frameID].nodes[nodeID].connectionCallBack = callBack;

            //console.log(callBacks[objectID].frames[frameID].nodes[nodeID]);

        }
    }
};

exports.removeReadListeners = function (objectName, frameName){
    var objectID = utilities.readObject(objectLookup, objectName);
    var frameID = objectID + frameName;
    if(callBacks[objectID].frames[frameID])
    delete callBacks[objectID].frames[frameID];
};

exports.map = function (x, in_min, in_max, out_min, out_max) {
    if (x > in_max) x = in_max;
    if (x < in_min) x = in_min;
    return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
};


exports.addEventListener = function (option, callBack){
    if(option === "reset") {
        cout("Add reset listener");
        callBacks.resetCallBacks.push(callBack);
    }
    if(option === "shutdown") {
        cout("Add reset listener");
        callBacks.shutdownCallBacks.push(callBack);
    }

};

exports.advertiseConnection = function (object, frame, node, logic){
    if(typeof logic === "undefined") {
        logic = false;
    }
    var objectID = utilities.readObject(objectLookup, object);
    var nodeID = objectID+frame+node;
    var frameID = objectID+frame;

    var message = {advertiseConnection:{
        object: objectID,
        frame: frameID,
        node: nodeID,
        logic: logic,
        names: [object, node]
    }};
    actionCallback(message);
};

exports.shutdown = function (){

    cout("call shutdowns");
    for (var i = 0; i < callBacks.shutdownCallBacks.length; i++) {
        callBacks.shutdownCallBacks[i]();
    }
};
var path = require('path');
exports.loadHardwareInterface = function (hardwareInterfaceName){
    return utilities.loadHardwareInterface(hardwareInterfaceName.split(path.sep).pop());
};



function cout(msg) {
    if (globalVariables.debug) console.log(msg);
}