# node-red-contrib-publishflows
PublishFlows allows developers to publish flows from their projects for use
in other projects. Developers can publish flows specific to tabs, subflows, or
arbitrary asset files.

Use the `Publish` option under project settings to define the parts of your
project that you wish to make available to other projects. A project that wishes
to use the published flows may simply list your project as a dependency.

## How It Works
A projects that lists another project as a dependency will automatically have
the dependent project's defined components (tabs, subflows, arbitrary asset
files) merged with the current project; overwriting any existing parts of the
same I.D. Only the defined parts from the PublishFlows' project will be copied
and merged. Users should avoid editing the given components as they will be
overwritten with the dependency content.

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
