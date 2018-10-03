module.exports = function(RED) {
/*
   * Furnish Publish tab with current subflows, files, tabs, and their associated
   * settings from the manifest.js file.
   */

  // Requires
  var projects = require(RED.settings.coreNodesDir + "/../red/runtime/storage/index.js").projects;
  var glob = require("glob");
  var S = require("string");
  var fs = require("fs");

  // Init vars
  var projectFolder = "";
  var projectName = "";

  // RED.events.on("runtime-event", function(e) {
  //   if ("runtime-deploy" != e.id) return;
  //   var pf = RED.settings.functionGlobalContext.get("publishflows");
  // });

  // Service merge publishflows button and publish panel
  RED.httpAdmin.get("/publishflows", RED.auth.needsPermission("publishflows.read"), function(req, res) {

    // Perform merge publishflows
    if (req.query.hasOwnProperty("merge")) {
      if (req.query.merge) {
        mergePublishflows();
        res.end();
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
    }else{
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
                o.path = S(o.path).replaceAll(RED.settings.userDir, '~').toString();
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

  function mergePublishflows() {
    var nodes = require(RED.settings.coreNodesDir + "/../red/runtime/nodes/index.js");
    projects.getFlows().then(function() {
      var sav = JSON.stringify(arguments[0]);
      var man = RED.settings.functionGlobalContext.get("publishflows");

      // For each manifest.js, locate the flow file via it's package.js
      man.forEach(function(m) {
        var f = m.path + JSON.parse(fs.readFileSync(m.path + '/package.json', 'utf8'))['node-red']['settings']['flowFile'];
        console.log(f);
      });
      //console.log(sav);
      // if (s.indexOf("Test 1 Flow") != -1) {
      //   // Update the flow and the user interface
      //   s = S(s).replaceAll("Test 1 Flow", "Something Else Flow").toString();
      //   console.log(s);
      //   nodes.setFlows(JSON.parse(s));
      // }
    });
  }

  RED.httpAdmin.post("/publishflows", RED.auth.needsPermission("publishflows.write"), function(req, res) {
    if (req.query.hasOwnProperty("project")) {
      projectName = req.query.project;
      projectFolder = RED.settings.userDir + "/projects/" + projectName;
      if (fs.existsSync(projectFolder)) {
        writeManifestJS(JSON.parse(JSON.stringify(req.body)));
        res.send("{}");
      }else{
        res.status(404).end();
      }
    }else{
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
        if (typeof ap.package["node-red"]["nodes"][ap.name] != "undefined") {
          delete ap.package["node-red"]["nodes"][ap.name];
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
    ap.package["node-red"]["nodes"][ap.name] = "manifest.js";
    projects.updateProject(null, ap.name, {"dependencies":{}});
    projects.updateProject(null, ap.name, dep);
    var nodes = require(RED.settings.coreNodesDir + "/../red/runtime/nodes/index.js");
    x = 0;
  }

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
