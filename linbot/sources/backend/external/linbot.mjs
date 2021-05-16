// Import utilities
import { Database, File, Hash, Utilities } from "../internal/utilities.mjs";
import { Client, MessageAttachment } from "discord.js";
import Process from "child_process";

// Initialize database
const database = new Database("sessions", {
	channel: {
		id: "string",
		name: "string"
	},
	container: {
		name: "string",
		type: "string",
		context: "string"
	}
});

// CLI and JS API
export class Linbot {

	static initialize(channelName, channelID, repository = "ubuntu:20.04") {
		// Create container name
		let container = Utilities.random(10);

		// Create a new entry in the database
		database.set(channelID, {
			channel: {
				id: channelID,
				name: channelName
			},
			container: {
				name: container,
				type: repository,
				context: "/home/"
			}
		});

		// Create the container
		return Process.execSync(`docker run -pids-limit 50 --tty --detach --name ${container} ${repository} /bin/sh`).toString();
	}

	static context(sessionID, directory) {
		// Fetch data from database
		let entry = database.get(sessionID);

		// Modify data
		entry.container.context = directory;

		// Update database
		database.set(sessionID, entry);
	}

	static execute(sessionID, command) {
		// Read the database
		let entry = database.get(sessionID);

		// Create the output buffer
		let output;

		// Execute in child process
		try {
			output = Process.execSync(`docker exec -w ${Linbot.#escape(entry.container.context)} ${entry.container.name} sh -c ${Linbot.#escape(command)}`).toString();
		} catch (e) {
			output = e.message;
		} finally {
			return output;
		}
	}

	static upload(sessionID, buffer, file) {
		// Push the file into the container
		Linbot.execute(sessionID, `base64 -d '${buffer.to("base64")}' > ${file}`);
	}

	static download(sessionID, file) {
		// Pull the file from the container
		return Buffer.from(Linbot.execute(sessionID, `cat ${file} | base64`), "base64");
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
		const sessionID = channel.id;

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
						let result = Linbot.execute(sessionID, command);

						// Update message
						message.edit(`\`\`\`bash\n${command}\n\`\`\`\n\`\`\`\n${result.length > 0 ? result : "No output"}\`\`\``);
					}
				).catch();
			} else if (receivedMessage.content.startsWith("#")) {
				// Substitute string
				let splits = receivedMessage.content.substring(1).trim().split(" ", 2);
				const action = splits.shift();
				const parameter = splits.shift();

				// Check possible actions
				if (action === "directory") {
					// Change working directory
					Linbot.context(sessionID, parameter);

					// Send reply
					channel.send(`Changed working directory to \`${parameter}\``);
				} else if (action === "create") {
					// Initialize container
					Linbot.initialize(channel.name, sessionID, parameter);

					// Send reply
					channel.send(`Container was created`);
				} else if (action === "upload") {
					// Check attachement
					if (!message.attachments) {
						channel.send("Missing attachment to upload");
						return;
					}

					// Upload files
					let attachment = message.attachments.array()[0];
					// Linbot.upload(sessionID, , parameter);
				} else if (action === "download") {
					channel.send(new MessageAttachment(Linbot.download(sessionID, parameter), parameter.split("/").pop()));
				}
			}
		} catch (e) {
			channel.send(`Oops. Error: \`${e.message}\``);
		}
	}
});

// Discord login
client.login(process.env.DISCORD_TOKEN);

// Web API routes
export const Routes = {
	linbot: {
		list: {

		},
		query: {

		},
		initialize: {

		}
	}
};