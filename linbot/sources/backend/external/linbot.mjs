// Import utilities
import { Database, File, Hash, Utilities } from "../internal/utilities.mjs";
import { Client, MessageAttachment } from "discord.js";

import FileSystem from "fs";
import Process from "child_process";
import Request from "request";

// Initialize database
const database = new Database("sessions", {
	name: "string",
	type: "string",
	context: "string"
});

// CLI and JS API
export class Linbot {

	static initialize(session, repository = "ubuntu:20.04") {
		// Terminate currently running container
		Linbot.terminate(session);

		// Create container name
		let container = Utilities.random(10);

		// Create the container
		Process.execSync(`docker run --pids-limit 50 --tty --detach --name ${container} ${repository} /bin/sh`).toString();

		// Create a new entry in the database
		database.set(session, {
			name: container,
			type: repository,
			context: "/home/"
		});
	}

	static terminate(session) {
		// Make sure database has entry
		if (!database.has(session))
			return;

		// Query entry
		let entry = database.get(session);

		// Kill container
		Process.execSync(`docker rm -f ${entry.name}`).toString();
	}

	static context(session, directory) {
		// Fetch data from database
		let entry = database.get(session);

		// Modify data
		entry.context = directory;

		// Update database
		database.set(session, entry);
	}

	static execute(session, command) {
		// Read the database
		let entry = database.get(session);

		// Create the output buffer
		let output;

		// Execute in child process
		try {
			output = Process.execSync(`docker exec -w ${Linbot.#escape(entry.context)} ${entry.name} sh -c ${Linbot.#escape(command)}`).toString();
		} catch (e) {
			output = e.message;
		} finally {
			return output.substring(output.length - 1500);
		}
	}

	static upload(session, buffer, file) {
		// Push the file into the container
		Linbot.execute(session, `echo ${buffer.toString("base64")} | base64 -d - > ${file}`);
	}

	static download(session, file) {
		// Pull the file from the container
		return Buffer.from(Linbot.execute(session, `cat ${file} | base64`), "base64");
	}

	static #escape(parameter) {
		return `"${parameter.replace(/(["'$`\\])/g, '\\$1')}"`
	}
};

// Discord API
const client = new Client();

// Handle discord calls
client.on("message", (receivedMessage) => {
	if (receivedMessage.author !== client.user) {
		// Parse sessionID
		const channel = receivedMessage.channel;
		const session = channel.id;

		// Try all
		try {
			// Parse input
			if (receivedMessage.content.startsWith("$")) {
				// Parse command
				const command = receivedMessage.content.substring(1).trim();

				// Send initial message
				channel.send(`Running command \`${command}\``).then(
					(message) => {
						// Execute command
						let result = Linbot.execute(session, command);

						// Update message
						message.edit(`\`\`\`bash\n${command}\n\`\`\`\`\`\`\n${result.length > 0 ? result : "No output"}\`\`\``);
					}
				).catch();
			} else if (receivedMessage.content.startsWith("#")) {
				// Substitute string
				let splits = receivedMessage.content.substring(1).trim().split(" ", 2);

				// Parse splits
				const action = splits.shift();
				const parameter = splits.shift();

				// Check possible actions
				if (action === "help") {
					// Print help message
					channel.send("```\n#help - show this message\n#restart [IMAGE]- restart your shell\n#upload [PATH] - upload a file\n#download [PATH] - download a path\n#directory [PATH] - change working directory\n```");
				} else if (action === "directory") {
					// Change working directory
					Linbot.context(session, parameter);
					// Send reply
					channel.send(`Changed context to \`${parameter}\``);
				} else if (action === "restart") {
					// Initialize container
					Linbot.initialize(session, parameter);
					// Send reply
					channel.send(`Shell was created!`);
				} else if (action === "upload") {
					// Check attachement
					let attachment;
					if (!(attachment = receivedMessage.attachments.array().shift())) {
						channel.send("Missing attachment!");
						return;
					}
					// Download file and push to container
					Request({
						url: attachment.url,
						encoding: null
					}, (error, response, buffer) => {
						// Push to container
						Linbot.upload(session, buffer, parameter);
						// List files
						channel.send(`\`\`\`bash\n${Linbot.execute(session, `ls -lahS ${parameter}`)}\`\`\``);
					});
				} else if (action === "download") {
					// Download the file
					channel.send(new MessageAttachment(Linbot.download(session, parameter), parameter.split("/").pop()));
				}
			}
		} catch (e) {
			channel.send(`Ouch. \`${e.message}\``);
		}
	}
});

// Discord login
client.login(process.env.DISCORD_TOKEN);

// Web API routes
export const Routes = {
	linbot: {
		link: {
			handler: () => {
				return process.env.DISCORD_ID;
			},
			parameters: {}
		}
	}
};