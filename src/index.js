import { Command } from "commander";
import chalk from "chalk";
import figlet from "figlet";
import inquirer from "inquirer";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execPromise = promisify(exec);
const program = new Command();

const text = "beluga stack";

figlet.text(
  text,
  {
    font: "Slant",
    horizontalLayout: "default",
    verticalLayout: "default",
    width: 80,
    whitespaceBreak: false,
  },
  function (err, data) {
    if (err) {
      console.log("Something went wrong...");
      console.dir(err);
      return;
    }
    console.log(data);
  }
);

program
  .version("1.0.0")
  .description("Create a new beluga stack app")
  .argument("<name>", "Project name")
  .action(async (name) => {
    try {
      console.log(chalk.green(`Creating a new project called ${name}`));

      const { appType } = await inquirer.prompt([
        {
          type: "list",
          name: "appType",
          message: "Which type of app would you like to create?",
          choices: [
            { name: "Beluga Stack ONE", value: "beluga-stack-one" },
            { name: "NextJS", value: "nextjs" },
            { name: "Vite", value: "vite" },
            { name: "tsup", value: "tsup" },
          ],
        },
      ]);

      let repoUrl;
      let templateDir;
      let targetDir;

      if (appType === "beluga-stack-one") {
        const { cmsOption } = await inquirer.prompt([
          {
            type: "list",
            name: "cmsOption",
            message: "Would you like to include Payload CMS?",
            choices: [
              { name: "With Payload CMS", value: "nextjs-payload" },
              { name: "Without Payload CMS", value: "nextjs" },
            ],
          },
        ]);

        repoUrl = "https://github.com/beluga-labs/beluga-stack-ONE";
        templateDir = path.join(name, "templates", cmsOption);
        targetDir = path.join(name, "apps", "web");
      } else {
        repoUrl = "https://github.com/beluga-labs/beluga-templates";
        templateDir = path.join(name, "templates", appType);
        targetDir = name; // Kopiere den Inhalt direkt ins Root-Verzeichnis
      }

      console.log(chalk.cyan(`Cloning the repository from ${repoUrl}...`));
      await execPromise(`git clone ${repoUrl} ${name}`);

      fs.cpSync(templateDir, targetDir, { recursive: true });

      const packageJsonPath = path.join(name, "package.json");
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

      const { packageManager } = await inquirer.prompt([
        {
          type: "list",
          name: "packageManager",
          message: "Which package manager would you like to use?",
          choices: [
            { name: "npm", value: "npm" },
            { name: "yarn", value: "yarn" },
            { name: "pnpm", value: "pnpm" },
            { name: "bun", value: "bun" },
          ],
        },
      ]);

      packageJson.packageManager = packageManager;
      fs.writeFileSync(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      console.log(
        chalk.cyan(`Installing dependencies with ${packageManager}...`)
      );
      await execPromise(`cd ${name} && ${packageManager} install`);

      fs.rmSync(path.join(name, "templates"), { recursive: true, force: true });
      fs.rmSync(path.join(name, ".git"), { recursive: true, force: true });

      await execPromise(`cd ${name} && git init`);

      console.log(chalk.green("Setup complete!"));
    } catch (error) {
      console.error(chalk.red("An error occurred during setup:"), error);
    }
  });

program.parse();
