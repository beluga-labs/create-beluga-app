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
  .version("0.2.0")
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
            { name: "beluga stack ONE", value: "beluga-stack-one" },
            // coming soon
            // { name: "NextJS", value: "nextjs" },
            // { name: "Vite", value: "vite" },
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

      if (appType !== "beluga-stack-one") {
        // Lösche alle Dateien auf der Root-Ebene außer dem templates-Ordner
        const rootFiles = fs.readdirSync(name);
        for (const file of rootFiles) {
          if (file !== "templates" && file !== ".git") {
            fs.rmSync(path.join(name, file), { recursive: true, force: true });
          }
        }

        // Verschiebe den Inhalt des gewählten Templates ins Root-Verzeichnis
        const templateContent = fs.readdirSync(templateDir);
        for (const item of templateContent) {
          fs.cpSync(path.join(templateDir, item), path.join(targetDir, item), {
            recursive: true,
          });
        }

        // Lösche den templates-Ordner
        fs.rmSync(path.join(name, "templates"), {
          recursive: true,
          force: true,
        });
      } else {
        fs.cpSync(templateDir, targetDir, { recursive: true });
      }

      const packageJsonPath = path.join(targetDir, "package.json");
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

      const { packageManager } = await inquirer.prompt([
        {
          type: "list",
          name: "packageManager",
          message: "Which package manager would you like to use?",
          choices: [
            { name: "pnpm", value: "pnpm" },
            { name: "npm", value: "npm" },
            { name: "yarn", value: "yarn" },
            { name: "bun", value: "bun" },
          ],
        },
      ]);

      // Ermitteln der Version des Paketmanagers
      let packageManagerVersion = "";
      if (packageManager === "pnpm") {
        const { stdout } = await execPromise("pnpm --version");
        packageManagerVersion = `pnpm@${stdout.trim()}`;
      } else if (packageManager === "npm") {
        const { stdout } = await execPromise("npm --version");
        packageManagerVersion = `npm@${stdout.trim()}`;
      } else if (packageManager === "yarn") {
        const { stdout } = await execPromise("yarn --version");
        packageManagerVersion = `yarn@${stdout.trim()}`;
      } else if (packageManager === "bun") {
        const { stdout } = await execPromise("bun --version");
        packageManagerVersion = `bun@${stdout.trim()}`;
      }

      packageJson.packageManager = packageManagerVersion;
      fs.writeFileSync(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      console.log(
        chalk.cyan(`Installing dependencies with ${packageManager}...`)
      );
      await execPromise(`cd ${targetDir} && ${packageManager} install`);

      fs.rmSync(path.join(name, ".git"), { recursive: true, force: true });

      await execPromise(`cd ${name} && git init`);

      console.log(chalk.green("Setup complete!"));
    } catch (error) {
      console.error(chalk.red("An error occurred during setup:"), error);
    }
  });

program.parse();
