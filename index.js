const fs = require("fs-extra");
const { spawnSync } = require("child_process");
const inquirer = require("inquirer");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

async function createResourceGroup(resourceGroupName) {
  const existsCommand = `az group exists --name ${resourceGroupName}`;
  const { stdout } = await exec(existsCommand);
  const groupExists = JSON.parse(stdout.trim());

  if (!groupExists) {
    const createCommand = `az group create --name ${resourceGroupName} --location westus2`;
    await exec(createCommand);
    console.log(`Resource group '${resourceGroupName}' created successfully!`);
  } else {
    console.log(`Resource group '${resourceGroupName}' already exists.`);
  }
}

async function createStorageAccount(storageAccountName, resourceGroupName) {
  const existsCommand = `az storage account check-name --name ${storageAccountName} --query 'nameAvailable'`;
  const { stdout } = await exec(existsCommand);
  const nameAvailable = JSON.parse(stdout.trim());

  if (nameAvailable) {
    const createCommand = `az storage account create --name ${storageAccountName} --resource-group ${resourceGroupName} --location westus2 --sku Standard_LRS --kind StorageV2`;
    await exec(createCommand);
    console.log(
      `Storage account '${storageAccountName}' created successfully!`
    );
  } else {
    console.log(`Storage account '${storageAccountName}' already exists.`);
  }
}

async function createFunctionApp() {
  // Step 1: Prompt the user for inputs
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "appName",
      message: "Enter the name for your function app:",
    },
    // Add more prompts for desired inputs (e.g., resource group, region, etc.)
  ]);

  const { appName } = answers;

  // Step 2: Create an Express application using express-generator
  console.log("Creating Express application...");
  const expressCommand = `npx express-generator --no-view ${appName}`;
  await exec(expressCommand);

  console.log("Express application created successfully!");

  // Step 3: Create the functions folder within the Express application directory
  const functionsPath = `${appName}/functions`;
  fs.mkdirSync(functionsPath);

  // Step 4: Prompt the user for Azure Function details
  const functionAnswers = await inquirer.prompt([
    {
      type: "input",
      name: "resourceGroup",
      message:
        "Enter the name of the Azure resource group (Leave blank to create a new resource group using the app name):",
    },
    {
      type: "input",
      name: "storageAccount",
      message: "Enter the name of the Azure storage account:",
    },
    // Add more prompts for other Azure Function details
  ]);

  const { resourceGroup, storageAccount } = functionAnswers;

  //create resourse group.
  await createResourceGroup(resourceGroup);
  await createStorageAccount(storageAccount, resourceGroup || appName);
  const azCliCommand = `az functionapp create --name ${appName} --resource-group ${
    resourceGroup || appName
  } --functions-version 4 --consumption-plan-location westus2 --runtime node --os-type linux --storage-account ${
    storageAccount || appName
  }`;

  // Step 5: Change to the Express application directory
  process.chdir(appName);

  // Step 6: Execute the Azure CLI command to create the Function App
  console.log("Creating Azure Function App...");
  spawnSync(azCliCommand, { shell: true, stdio: "inherit" });

  console.log("Function App created successfully!");

  // Step 7: Update the package.json file of the Express app
  const packageJsonPath = `${process.cwd()}/package.json`;
  const packageJson = require(packageJsonPath);

  // Add the startup command for Azure Function alongside the existing startup command
  packageJson.scripts["start-function"] = "cd functions && func start";

  // Save the updated package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  console.log("Package.json updated successfully!");
}

createFunctionApp().catch(console.error);
