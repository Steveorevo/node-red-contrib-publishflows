# node-red-contrib-subprojects
Subprojects allows projects to use other project parts as dependencies. The
parts can be tabs containing flows, subflows, or arbitrary asset files.

Use the `Publish` option to define the parts of your project that you wish to
make available to other projects. A project that wishes to use the published
components may simply list your project as a dependency.

## How It Works
A projects that lists another project as a dependency will automatically have
the dependent project's defined parts merged with the current project;
overwriting any existing parts of the same I.D. Only the defined parts from the
subproject will be copied and merged. Users should avoid editing the given parts
as they will be overwritten with the subproject's content.

## What to Publish
A subproject should only publish elements that it wishes to furnish to other
projects. The subproject should avoid publishing irrelevant items such as test
flows, examples, etc. as these elements would persist in a merge, add bulk, or
may inhibit code reuse for the referring project.

If components in a subproject are deemed optional; consider breaking down the
subproject further into multiple subprojects and dependencies. A subproject that
requires elements from another subproject should list them as items to publish
in their own publishing definition to avoid missing elements.

## Installation
Run the following command in your Node-RED user directory (typically ~/.node-red):

    npm install node-red-contrib-subprojects

A new option will appear under the Projects panel titled, "Publish". The Publish
tab will show a tree control to select subflows, tabs, and other asset files.
