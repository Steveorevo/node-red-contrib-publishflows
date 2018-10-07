module.exports = function(RED) {
/*
   * Furnish Publish tab with current subflows, files, tabs, and their associated
   * settings from the manifest.js file.
   */

  // Requires
  var projects = require(RED.settings.coreNodesDir + "/../red/runtime/storage/index.js").projects;
  var fse = require("fs-extra");
  var glob = require("glob");
  var S = require("string");
  var fs = require("fs");

  // Init vars
  var projectFolder = "";
  var projectName = "";

  // Service merge publishflows button and publish panel
  RED.httpAdmin.get("/publishflows", RED.auth.needsPermission("publishflows.read"), function(req, res) {

    // Perform merge publishflows
    if (req.query.hasOwnProperty("merge")) {
      if (req.query.merge) {
        mergePublishFlows(null).then(function(msg) {
          res.send(msg).end();
        });
      }
      return;
    }

    // Perform remove of publishflows
    if (req.query.hasOwnProperty("remove")) {
      if (req.query.remove) {
        removePublishFlow(req.query.remove).then(function(rmv) {
          mergePublishFlows(rmv).then(function(msg) {
            res.send(msg).end();
          });
        });
      }
      return;
    }

    // Furnish publishflows info to publish panel
    if (req.query.hasOwnProperty("project")) {
      projectName = req.query.project;
      projectFolder = RED.settings.userDir + "/projects/" + projectName;
      if (fs.existsSync(projectFolder)) {
        readManifestJS().then(function(publish) {
          res.json(publish);
        });
      }else{
        res.status(404).end();
      }
    } else {
	    res.status(404).end();
    }
  });

  function readManifestJS() {
    return new Promise(function(resolve, reject) {
      if (fs.existsSync(projectFolder + "/manifest.js")) {
        var sCode = S(fs.readFileSync(projectFolder + "/manifest.js", 'utf8'));
        sCode = sCode.delLeftMost("pf.push(");
        sCode = sCode.delRightMost("  );").replaceAll("__dirname", '"~|~"').toString();
        var sav = JSON.parse(sCode);

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
      } else {
        getDefaultManifest().then(function(man) {
          resolve(man);
        });
      }
    });
  }  

  function getDefaultManifest() {
    // Get current subflows, tabs, and files
    var man = {
      subflows: [],
      files: [],
      tabs: [],
      path: "~|~"
    }
    RED.nodes.eachNode(function(n) {
      if (n.type == "subflow") {
        man.subflows.push({
          name: n.name,
          id: n.id,
          checked: ""
        });
      }
      if (n.type == "tab") {
        man.tabs.push({
          label: n.label,
          id: n.id,
          checked: ""
        });
      }
    });

    // Get current folderitems from filesystem    
    return new Promise(function(resolve, reject) {
      glob(projectFolder + '/**/*', function(err, files) {
        if (err) {
          console.log('Error', err);
        } else {
          // Omit credentials and flow files from listing
          var oFiles = [];
          var aOmit = [];
          var package = JSON.parse(fs.readFileSync(projectFolder + "/package.json"));
          aOmit.push(projectFolder.toLowerCase() + "/" + package["node-red"].settings.credentialsFile);
          aOmit.push(projectFolder.toLowerCase() + "/" + package["node-red"].settings.flowFile);

          // Omit package, manifest, readme.md, .git files/folders
          aOmit.push(projectFolder.toLowerCase() + "/package.json");
          aOmit.push(projectFolder.toLowerCase() + "/manifest.html");
          aOmit.push(projectFolder.toLowerCase() + "/manifest.js");
          aOmit.push(projectFolder.toLowerCase() + "/readme.md");
          aOmit.push(projectFolder.toLowerCase() + "/.gitignore");
          aOmit.push(projectFolder.toLowerCase() + "/.git");
          files.forEach(function(f) {
            f = S(f);
            var o = {
              isDirectory: false,
              name: f.getRightMost("/").toString(),
              path: f.toString(),
              id: f.delLeftMost("projects").delLeftMost(projectName).replaceAll("/", "-").replaceAll(".", "-").slugify().toString(),
              checked: ""
            };
            if (fs.lstatSync(o.path).isDirectory()) {
              o.isDirectory = true;
            }
            // Omit .backup files too
            if (aOmit.indexOf(o.path.toLowerCase()) == -1) {
              if (false == o.path.endsWith(".backup")) {

                // Mask user directory path
                o.path = S(o.path).substr(projectFolder.length).toString();
                oFiles.push(o);
              }
            }
          });
          man.files = oFiles;

          // Furnish list of dependencies that are publishflows
          man.publishFlows = [];
          var pf = RED.settings.functionGlobalContext.get("publishflows");
          if (typeof pf != "undefined") {
            pf.forEach(function(p) {
              man.publishFlows.push(S(p.path).getRightMost("/").toString());
            });
          }
          resolve(man);
        }
      });
    });
  }

  function removePublishFlow(pf) {
    return new Promise(function(resolve, reject) {
      projects.getFlows().then(function() {
        var sav = JSON.parse(JSON.stringify(arguments[0]));
        var man = RED.settings.functionGlobalContext.get("publishflows");
        man.forEach(function(m) {
          if (S(m.path).getRightMost("/") != pf) return;

          // Remove related tabs
          if (typeof m.tabs != "undefined") {
            m.tabs.forEach(function(t) {
              if (t.checked != "checked") return;

              // Remove existing
              for (var n = 0; n < sav.length; n++) {
                if (sav[n].id == t.id) {
                  delete sav[n];
                }else{
                  if (typeof sav[n].z != "undefined") {
                    if (sav[n].z == t.id) {
                      delete sav[n];
                    }
                  }
                }
              }

              // Re-index
              var red = [];
              for (var n = 0; n < sav.length; n++) {
                if (typeof sav[n] != "undefined") {
                  red.push(sav[n]);
                }
              }
              sav = red;
            });
          }

          // Remove related subflows
          if (typeof m.subflows != "undefined") {
            m.subflows.forEach(function(s) {

              // Remove existing
              for (var n = 0; n < sav.length; n++) {
                if (sav[n].id == s.id) {
                  delete sav[n];
                }else{
                  if (typeof sav[n].z != "undefined") {
                    if (sav[n].z == s.id) {
                      delete sav[n];
                    }else{

                      // Remove subflow instances
                      if (S(sav[n].type).getRightMost(":") == s.id) {
                        delete sav[n];
                      }
                    }
                  }
                }
              }

              // Re-index
              var red = [];
              for (var n = 0; n < sav.length; n++) {
                if (typeof sav[n] != "undefined") {
                  red.push(sav[n]);
                }
              }
              sav = red;
            });
          }

          // Remove related files
          if (typeof m.files != "undefined") {

            // First pass, delete any defined files
            m.files.forEach(function(f) {
              if (f.checked != "checked") return;
              if (f.isDirectory != 'true') {
                var des = projects.getActiveProject().path + f.path;  
                if (fs.existsSync(des)) {
                  fs.unlinkSync(des);
                }
              }
            });

            // Second pass, delete any empty folders
            m.files.forEach(function(f) {
              if (f.checked != "checked") return;
              if (f.isDirectory == 'true') {
                var des = projects.getActiveProject().path + f.path;  
                if (fs.existsSync(des)) {
                  if (fs.readdirSync(des).length == 0) {
                    fs.rmdirSync(des);
                  }
                }
              }
            });
          }
        });
        resolve(sav);
      });
    });
  }

  function mergePublishFlows(rmv) {
    return new Promise(function(resolve, reject) {
      var nodes = require(RED.settings.coreNodesDir + "/../red/runtime/nodes/index.js");
      projects.getFlows().then(function() {
        if (rmv == null) {
          var sav = JSON.parse(JSON.stringify(arguments[0]));
        }else{
          sav = rmv; // Use modified from prior removePublishFlow
        }
        var man = RED.settings.functionGlobalContext.get("publishflows");
        var dep = projects.getActiveProject().package.dependencies;

        // Process each manifests file entry
        man.forEach(function(m) {
          var f = fs.readFileSync(m.path + '/package.json', 'utf8');
          f = m.path + '/' + JSON.parse(f)['node-red']['settings']['flowFile'];
          var pub = JSON.parse(fs.readFileSync(f, 'utf8'));

          // Check if manifest item is in this project's depedency list
          var isDependency = false;
          for (var key in dep) {
            if (key == S(m.path).getRightMost('/').toString()) {
              isDependency = true;
              break;
            }
          }
          if (true == isDependency) {
            // Process tabs
            if (typeof m.tabs != "undefined") {
              m.tabs.forEach(function(t) {
                if (t.checked != "checked") return;
                // Remove existing
                for (var n = 0; n < sav.length; n++) {
                  if (sav[n].id == t.id) {
                    delete sav[n];
                  }else{
                    if (typeof sav[n].z != "undefined") {
                      if (sav[n].z == t.id) {
                        delete sav[n];
                      }
                    }
                  }
                }

                // Re-index
                var red = [];
                for (var n = 0; n < sav.length; n++) {
                  if (typeof sav[n] != "undefined") {
                    red.push(sav[n]);
                  }
                }
                sav = red;

                // Insert update
                for (var n = 0; n < pub.length; n++) {
                  if (pub[n].id == t.id) {
                    sav.push(pub[n]);
                  }else{
                    if (typeof pub[n].z != "undefined") {
                      if (pub[n].z == t.id) {
                        sav.push(pub[n]);
                      }
                    }
                  }
                }
              });
            }

            // Process subflows
            if (typeof m.subflows != "undefined") {
              m.subflows.forEach(function(s) {
                if (s.checked != "checked") return;
                // Remove existing
                for (var n = 0; n < sav.length; n++) {
                  if (sav[n].id == s.id) {
                    delete sav[n];
                  }else{
                    if (typeof sav[n].z != "undefined") {
                      if (sav[n].z == s.id) {
                        delete sav[n];
                      }
                    }
                  }
                }

                // Re-index
                var red = [];
                for (var n = 0; n < sav.length; n++) {
                  if (typeof sav[n] != "undefined") {
                    red.push(sav[n]);
                  }
                }
                sav = red;

                // Insert update
                for (var n = 0; n < pub.length; n++) {
                  if (pub[n].id == s.id) {
                    sav.push(pub[n]);
                  }else{
                    if (typeof pub[n].z != "undefined") {
                      if (pub[n].z == s.id) {
                        sav.push(pub[n]);
                      }
                    }
                  }
                }
              });
            }
    
            // Process files and folders
            if (typeof m.files != "undefined") {
              m.files.forEach(function(f) {
                if (f.checked != "checked") return;
                var des = projects.getActiveProject().path + f.path;
                var src = m.path + f.path;

                // Create directories if they don't exist
                if (f.isDirectory == 'true') {
                  fse.ensureDirSync(des);
                }else{
                  if (S(des).delRightMost("/") != "") {
                    fse.ensureDirSync(S(des).delRightMost("/").toString());
                  }
                  fse.copyFileSync(src, des, {overwrite:true, errorOnExist:false});
                }
              });
            }
          }
        });

        // Submit changes & notify update
        if (JSON.stringify(sav) != JSON.stringify(arguments[0])) {
          nodes.setFlows(sav).then(function() {
            resolve('');
          });
        } else {
          resolve('PublishFlows are up to date.');
        }
      });  
    });
  }

  RED.httpAdmin.post("/publishflows", RED.auth.needsPermission("publishflows.write"), function(req, res) {
    if (req.query.hasOwnProperty("project")) {
      projectName = req.query.project;
      projectFolder = RED.settings.userDir + "/projects/" + projectName;
      if (fs.existsSync(projectFolder)) {
        writeManifestJS(JSON.parse(JSON.stringify(req.body)));
        res.send("{}");
      } else {
        res.status(404).end();
      }
    } else {
	    res.status(404).end();
    }
  });

  function writeManifestJS(man) {
    if (man == "") return;
    var ap = projects.getActiveProject();
    var dep = { "dependencies" : JSON.parse(JSON.stringify(ap.package['dependencies']))};

    // Cleanup unnecessary manifest files and package.js if nothing is published
    if (JSON.stringify(man).indexOf('"checked":"checked"') == -1) {
      if (fs.existsSync(projectFolder + "/manifest.js")) {
        fs.unlinkSync(projectFolder + "/manifest.js");
      }
      if (fs.existsSync(projectFolder + "/manifest.html")) {
        fs.unlinkSync(projectFolder + "/manifest.html");
      }
      if (typeof ap.package["node-red"]["nodes"] != "undefined") {
        if (typeof ap.package["node-red"]["nodes"][ap.name + "_manifest"] != "undefined") {
          delete ap.package["node-red"]["nodes"][ap.name + "_manifest"];
        }
        if (JSON.stringify(ap.package["node-red"]["nodes"]) == "{}") {
          delete ap.package["node-red"]["nodes"];
        }
      }

      // Force package.js save & update
      projects.updateProject(null, ap.name, {"dependencies":{}});
      projects.updateProject(null, ap.name, dep);
      return;
    }

    // Write manifest files
    var sCode = "/**\n";
    sCode += " * This code is machine generated.\n";
    sCode += " */\n";
    sCode += "module.exports = function(RED) {\n";
    sCode += "  var pf = RED.settings.functionGlobalContext.get(\"publishflows\");\n";
    sCode += "  if (typeof pf == \"undefined\") pf = [];\n";
    sCode += "  pf.push(\n";
    sCode += S(JSON.stringify(man, null, 2)).replaceAll('"~|~"', "__dirname").replaceAll("\n", "\n    ").prepend("    ").toString();
    sCode += "\n  );\n";
    sCode += "  RED.settings.functionGlobalContext.set(\"publishflows\", pf);\n";
    sCode += "};\n";
    fs.writeFileSync(projectFolder + "/manifest.js", sCode);
    fs.writeFileSync(projectFolder + "/manifest.html", "<!-- silence is golden -->");

    // Update package.js
    if (typeof ap.package["node-red"]["nodes"] == "undefined") {
      ap.package["node-red"]["nodes"] = {};
    }
    ap.package["node-red"]["nodes"][ap.name + "_manifest"] = "manifest.js";
    projects.updateProject(null, ap.name, {"dependencies":{}});
    projects.updateProject(null, ap.name, dep);
    var nodes = require(RED.settings.coreNodesDir + "/../red/runtime/nodes/index.js");
    x = 0;
  }
  RED.nodes.registerType("publishflows",function(){
    RED.nodes.createNode(this, config);
  });

  // JavaScript version of var_dump
  function var_dump(arr, level) {
      var dumped_text = "";
      if (!level)
          level = 0;

      //The padding given at the beginning of the line.
      var level_padding = "";
      for (var j = 0; j < level + 1; j++)
          level_padding += "    ";

      if (typeof(arr) === 'object') { //Array/Hashes/Objects 
          for (var item in arr) {
              var value = arr[item];

              if (typeof(value) === 'object') { //If it is an array,
                  dumped_text += level_padding + "'" + item + "' ...\n";
                  dumped_text += var_dump(value, level + 1);
              } else {
                  dumped_text += level_padding + "'" + item + "' => " + "(" + typeof(value) + ") \"" + value + "\"\n";
              }
          }
      } else { //Stings/Chars/Numbers etc.
          dumped_text = "(" + typeof(arr) + ") " + arr;
          return dumped_text;
      }
      if (level===0){
          return '(object)' + String.fromCharCode(10) + dumped_text;
      }else{
          return dumped_text;
      }
  }
}
