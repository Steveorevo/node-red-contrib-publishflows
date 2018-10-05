# node-red-contrib-publishflows
PublishFlows allows developers to publish flows from their 
[projects](https://nodered.org/docs/user-guide/projects/) for use in other
[projects](https://nodered.org/docs/user-guide/projects/). Developers can
publish flows specific to tabs, subflows, or arbitrary asset files that
live in the project's folder. PublishFlows bring the concept found in
other programming languages often referred to as a ***requirement***,
***include***, or ***dependency***.

Combined with [ActionFlows](https://flows.nodered.org/node/node-red-contrib-actionflows), 
PublishFlows can allow developers to create more modular, extendable, and
versatile designs to otherwise bulky and complex flows. 

Use the `Publish` option under project settings to define the parts of your
project that you wish to make available to other projects. A project that wishes
to use the published flows may simply list your project as a dependency. Use
PublishFlows to:

* Breakup complex projects into smaller sub-projects
* Lock project dependencies to a specific version
* Seperate test flows from runtime flows
* Update projects independently
* Make re-usable components

## How It Works
A project that lists another project as a dependency will automatically have
it's predefined components (tabs, subflows, arbitrary asset files) merged into
the current project; overwriting/updating any existing nodes that share the 
same I.D. 

Only the defined parts from the PublishFlows' project will be copied
and merged. The defined parts are stored in the project folder within a file
called manifest.js. The manifest file lists the components that are to be
shared and used within other projects. Users of the dependent project should
avoid editing the imported components as they will be overwritten with the
dependency content.

## Example Scenario
For example, say you have produced a subflow that you would like to reuse in
other projects. Here we have created a subflow with an *inject* node and *debug*
node that prints "Hello World!" in the debug window. This subflow is maintained
[within the project called publishflows-test](http://github.com/steveorevo/publishflows-test).

![Image of Subflow](https://raw.githubusercontent.com/Steveorevo/node-red-contrib-publishflows/master/publishflows/demo/subflow.jpg)

Simply [create a project](https://nodered.org/docs/user-guide/projects/)
that houses your subflow; perhaps include an example tab that uses the subflow
to illustrate it's use. We will only publish the subflow, not the example tab.
Under Project Settings **(1)** from the right side menu or '...' Project info button,
select the **(2)** Publish tab followed by **(3)** checkmarking the "Test Subflow".

![Image of project settings and publish tab](https://raw.githubusercontent.com/Steveorevo/node-red-contrib-publishflows/master/publishflows/demo/project-settings.jpg)

Clicking **(4)** close will cause PublishFlows to automatically generate a **(5)**
manifest.js file listing the "Test Subflow" for others to use in their projects.

![Image of manifest notification](https://raw.githubusercontent.com/Steveorevo/node-red-contrib-publishflows/master/publishflows/demo/manifest.jpg)

### Using the Example Scenario "Test Subflow" in Your Project
Now you can use the "Test Subflow" in your own/multiple other projects; maintaining
the original "Test Subflow" separately [within the project publishflows-test](http://github.com/steveorevo/publishflows-test).
In other programming languages, this concept is often referred to as an ***include***,
***requirement***, or ***dependency.

## What to Publish
A PublishFlows project should only publish elements that it wishes to furnish to
other projects. A project should avoid publishing irrelevant items such as test
flows, examples, etc. as excess components would persist during a merge, or may
cause unnecessary bulk, and/or may inhibit code reuse for the referring project.

If components in a PublishFlows project are deemed optional; consider breaking
down the dependency into multiple PublishFlow projects and dependencies. A
dependency that requires elements from another project should list them as items
to publish in their own "Publish" definition to avoid missing dependent elements.

#### Don't Publish
* Examples (if users want examples, they can always clone your project)
* Unused actionflows (keep the namespace clean and tidy)

#### Publish
* Flows from dependencies that are needed to make your published flows work
* Comment nodes giving credit to original authors
* Flows that can be re-used in other projects

## Installation
Run the following command in your Node-RED user directory (typically ~/.node-red):

    npm install node-red-contrib-publishflows

A new option will appear under the Projects panel titled, "Publish". The Publish
tab will show a tree control to select subflows, tabs, and other asset files.
