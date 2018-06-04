module.exports = function(RED) {
  // function SubprojectsNode(config) {
  //   RED.nodes.createNode(this, config);
  // }

  // Build list of publishable objects (tabs, subflows, and files)
  var projectFolder = "";
  var manifestFile = "";
  var projectName = "";
  var credFile = "";
  var flowFile = "";
  var subflows = null;
  var files = null;
  var tabs = null;

  function re_subprojects(e) {
    if (e.id != "runtime-deploy") return;
    subflows = [];
    files = [];
    tabs = [];

    // Current current tabs and subflows
    RED.nodes.eachNode(function(n) {
      if (n.type == "subflow") {
        subflows.push({
          name: n.name,
          id: n.id,
          checked: ""
        });
      }
      if (n.type == "tab") {
        tabs.push({
          label: n.label,
          id: n.id,
          checked: ""
        });
      }
    });
    console.log("re_subprojects " + JSON.stringify(e, 2));
  }
  function getDefaultManifest() {
    var man = {
      subflows: subflows,
      files: [],
      tabs: tabs
    };
    man.subflows = JSON.parse(JSON.stringify(subflows));
    man.tabs = JSON.parse(JSON.stringify(tabs));

    // Get current folderitems from filesystem
    var glob = require("glob");
    return new Promise(function(resolve, reject) {
      glob(projectFolder + '/**/*', function(err, files) {
        if (err) {
          console.log('Error', err);
        } else {
          var oFiles = [];
          var aOmit = [];
          aOmit.push(credFile.toLowerCase());
          aOmit.push(flowFile.toLowerCase());
          aOmit.push(projectFolder.toLowerCase() + "/package.json");
          aOmit.push(projectFolder.toLowerCase() + "/manifest.js");
          aOmit.push(projectFolder.toLowerCase() + "/readme.md");
          aOmit.push(projectFolder.toLowerCase() + "/.git");
          files.forEach(function(f) {
            var S = require("string");
            f = S(f);
            var o = {
              isDirectory: false,
              name: f.getRightMost("/").toString(),
              path: f.toString(),
              id: f.delLeftMost("projects").delLeftMost(projectName).replaceAll("/", "-").replaceAll(".", "-").slugify().toString(),
              checked: ""
            };
            var fs = require("fs");
            if (fs.lstatSync(o.path).isDirectory()) {
              o.isDirectory = true;
            }
            if (aOmit.indexOf(o.path.toLowerCase()) == -1) {
              if (false == o.path.endsWith(".backup")) {
                oFiles.push(o);
              }
            }
          });
          man.files = oFiles;
          resolve(man);
        }
      });
    });
  }
  function readManifestJS() {
    return new Promise(function(resolve, reject) {
      if (manifestFile == ""){
        resolve({
          subflows: subflows,
          files: [],
          tabs: tabs
        });
      }else{
        var S = require("string");
        var fs = require("fs");
        var sav = {
          subflows: [],
          files: [],
          tabs: []
        };
        if (fs.existsSync(manifestFile)) {
          var sCode = S(fs.readFileSync(manifestFile, 'utf8'));
          sCode = sCode.delLeftMost("    RED.subprojects.manifests.push(\n");
          sCode = sCode.getLeftMost("    );\n").toString();

          // Resolve userDir
          sCode = S(sCode).replaceAll('"~', '"' + RED.settings.userDir).toString();
          sav = JSON.parse(sCode);
        }

        // Merge default with saved; purge obsolete, irrelevant saved items
        getDefaultManifest().then(function(man) {
          var tp = ["subflows", "files", "tabs"];
          tp.forEach(function(t) {
            for (var m in man[t]){
              var mn = man[t][m];
              for (var s in sav[t]) {
                var sv = sav[t][s];
                if (mn.id == sv.id) {
                  mn.checked = sv.checked;
                }
              }
            }
          });
          resolve(man);
        });
      }
    });
  }
  function writeManifestJS(publish) {
    if (manifestFile == "") return;
    var fs = require("fs");
    if (JSON.stringify(publish).indexOf('"checked":"checked"') == -1) {
      if (fs.existsSync(manifestFile)) {
        fs.unlinkSync(manifestFile);
      }
      return;
    }
    var S = require("string");
    var sCode = "";
    sCode += "/**\n";
    sCode += " * This code is machine generated.\n";
    sCode += " */\n";
    sCode += "module.exports = function(RED) {\n";
    sCode += "  if (typeof RED.subprojects != 'undefined') {\n";
    sCode += "    RED.subprojects.manifests.push(\n";
    sCode += S(JSON.stringify(publish, null, 2)).replaceAll("\n", "\n      ").prepend("      ").toString();
    sCode += "\n    );\n";
    sCode += "  }\n";
    sCode += "};\n";

    // Let's be multiuser friendly and swap userDir for ~
    sCode = S(sCode).replaceAll('"' + RED.settings.userDir, '"~').toString();
    fs.writeFileSync(manifestFile, sCode);
  }
  function updatePackageFile(publish) {
    /*
     * Update the package.json file accordingly
     */
    if (projectFolder == "") return;
    var fs = require("fs");
    var jsonPackage = JSON.parse(fs.readFileSync(projectFolder + "/package.json"));
    if (JSON.stringify(publish).indexOf('"checked":"checked"') == -1) {
      // Remove existing definition
      if (typeof jsonPackage["node-red"] != "undefined") {
        if (typeof jsonPackage["node-red"]["nodes"] != "undefined") {
          if (typeof jsonPackage["node-red"]["nodes"] != "undefined") {
            if (typeof jsonPackage["node-red"]["nodes"][projectName] != "undefined") {
              delete jsonPackage["node-red"]["nodes"][projectName];
              if (JSON.stringify(jsonPackage["node-red"]["nodes"]) == "{}") {
                delete jsonPackage["node-red"]["nodes"];
                if (JSON.stringify(jsonPackage["node-red"]) == "{}") {
                  delete jsonPackage["node-red"];
                }
              }
            }
          }
        }
      }
    }else{
      // Create definition
      if (typeof jsonPackage["node-red"] == "undefined") {
        jsonPackage["node-red"] = {};
      }
      if (typeof jsonPackage["node-red"]["nodes"] == "undefined") {
        jsonPackage["node-red"]["nodes"] = {};
      }
      if (typeof jsonPackage["node-red"]["nodes"][projectName] == "undefined") {
        jsonPackage["node-red"]["nodes"][projectName] = "manifest.js";
      }
    }
    fs.writeFileSync(projectFolder + "/package.json", JSON.stringify(jsonPackage, null, 2));
    console.log("updatePackageFile");
  }
  /*
   * Furnish Publish tab with current subflows, files, tabs, and their associated
   * settings in the manifest.js file.
   */
  RED.httpAdmin.get("/subprojects", RED.auth.needsPermission("subprojects.read"), function(req, res) {
    if (req.query.hasOwnProperty("project")) {
      projectFolder = RED.settings.userDir + "/projects/" + req.query.project;
      manifestFile = projectFolder + "/manifest.js";
      projectName = req.query.project;
      credFile = projectFolder + "/" + req.query.cred;
      flowFile = projectFolder + "/" + req.query.flow;
      readManifestJS().then(function(publish) {
        res.json(publish);
      });
    }
  });
  RED.httpAdmin.post("/subprojects", RED.auth.needsPermission("subprojects.write"), function(req, res) {
    writeManifestJS(JSON.parse(JSON.stringify(req.body)));

    // Modify/update our manifest.js file before reloading
    if (req.query.hasOwnProperty("reload")) {
      var Project = require(RED.settings.coreNodesDir + "/../red/runtime/storage/localfilesystem/projects/Project.js");
      var projects = require(RED.settings.coreNodesDir + "/../red/runtime/storage/localfilesystem/projects/index.js");
      var ap = projects.getActiveProject();
      var name = ap.name;
      readManifestJS().then(function(publish) {
          // Modify our package.json before reloading
          updatePackageFile(publish)
      }).then(function() {
        return projects.setActiveProject(null, name);
      });
    }
  });
  RED.events.on("runtime-event", re_subprojects);
}
