
import { Plugin, MarkdownView, PluginSettingTab, App, Setting } from 'obsidian';

import OpenAI from "openai";

import { TFile } from 'obsidian';


interface MyPluginSettings {

    apiKey: string;

    maxTokens: number; 

    model: string; 

}


const DEFAULT_SETTINGS: MyPluginSettings = {

    apiKey: '',

    maxTokens: 500, 

    model: "gpt-4-vision-preview", 

}


function arrayBufferToBase64(buffer: ArrayBuffer): string {

    let binary = '';

    const bytes = new Uint8Array(buffer);

    const len = bytes.byteLength;

    for (let i = 0; i < len; i++) {

        binary += String.fromCharCode(bytes[i]);

    }

    return window.btoa(binary);

}

export default class MyPlugin extends Plugin {

    settings: MyPluginSettings;


    async onload() {

        await this.loadSettings();


        // Adds the command to the command palette

        this.addCommand({

            id: 'Use_Aeye_selected_text',

            name: 'Use Aeye with selected text as prompt',

            callback: () => this.convertImageToSend(),

        });


        // Adds a tab in the settings view

        this.addSettingTab(new SettingTab(this.app, this));

    }


    onunload() { }


    async loadSettings() {

        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    }

    

    async saveSettings() {

        await this.saveData(this.settings);

    }


	async convertImageToSend() {

		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
	
	
		if (!activeView) {
	
			console.error('No active markdown view');
	
			return;
	
		}
	
	
		const editor = activeView.editor;
	
		const selectedText = editor.getSelection();
	
	
		if (!selectedText) {
	
			console.error('No text selected');
	
			return;
	
		}
	
	
		const lines = editor.getValue().split('\n');
	
		const selectedLineNumber = editor.getCursor('from').line;
	
		let base64Image = '';
	
	
		// Look for the closest image before the selected line
	
		for (let i = selectedLineNumber - 1; i >= 0; i--) {
	
			const line = lines[i];
	
	
			// Change the regex pattern to match Obsidian's embed format
	
			const embedRegex = /!\[\[(.*?)\]\]/;
	
			const matchResult = line.match(embedRegex);
	
	
			if (matchResult && matchResult.length > 1) {
	
				const filePath = matchResult[1];
	
	
				try {
	
					base64Image = await this.convertImageToBase64(filePath);
	
					break;
	
				} catch (error) {
	
					console.error('Error while converting image to base64:', error);
	
					return;
	
				}
	
			}
	
		}
	
	
		if (!base64Image) {
	
			console.error('No image found before selected text.');
	
			return;
	
		}


        if (!base64Image) {

            console.error('No image found above selected text');

            return;

        }


        // Make the API call

        const openai = new OpenAI({ apiKey: this.settings.apiKey, dangerouslyAllowBrowser: true });

        try {

            const response = await openai.chat.completions.create({

                model: "gpt-4-vision-preview",

				max_tokens: 500,

                messages: [

					{

                        role: "system",

                        content: [

                            { type: "text", text: "je ben een ervaren jungiaanse analyst. Je bent een expert in het ontrafelen van symboliek uit afbeeldingen" },

                        ],

                    },

					{

                        role: "user",

                        content: [

                            { type: "text", text: selectedText },

                            {

                                type: "image_url",

                                image_url: {

                                    "url": base64Image,

                                },

                            },

                        ],

                    },

                ],

            });

            console.log(response.choices[0].message.content);

			this.insertTextBelowSelection(editor, `${response.choices[0].message.content}\n`);

		} catch (error) {
	
			console.error('API call failed:', error);
	
		}

    }


	insertTextBelowSelection(editor: CodeMirror.Editor, textToInsert: string): void {

		const cursor = editor.getCursor('to'); // Get the ending cursor position of the selection (or current cursor position)
	
		if (cursor.line === editor.lastLine()) {
	
			// If already on the last line, add a newline before inserting
	
			editor.replaceRange(`\n${textToInsert}`, cursor);
	
		} else {
	
			// Otherwise, insert directly below the current line
	
			const position = { line: cursor.line + 1, ch: 0 }; // Position at the beginning of the line after the selection
	
			editor.replaceRange(`${textToInsert}\n`, position); // Add a newline after the inserted text to separate from following content
	
		}
	
		editor.setCursor({ line: cursor.line + 1, ch: 0 }); // Place cursor after newly inserted text
	
	}


	async convertImageToBase64(filePath: string): Promise<string> {

		const file = this.app.vault.getAbstractFileByPath(filePath) as TFile | null;
	
	
		if (file && file instanceof TFile) {
	
			const arrayBuffer = await this.app.vault.readBinary(file);
	
			// Use the newly added function to convert the array buffer to Base64
	
			const base64String = arrayBufferToBase64(arrayBuffer);
	
			const mimeType = this.getMimeType(file.extension);
	
			return `data:${mimeType};base64,${base64String}`;
	
		} else {
	
			throw new Error(`No file found at path "${filePath}".`);
	
		}
	
	}
	
	
	getMimeType(extension: string): string {
	
		const mimeTypes: { [key: string]: string } = {
	
			'jpg': 'image/jpeg',
	
			'jpeg': 'image/jpeg',
	
			'png': 'image/png',
	
			// Add other file types as needed
	
		};
	
		return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
	
	}
	

}


class SettingTab extends PluginSettingTab {

    plugin: MyPlugin;


    constructor(app: App, plugin: MyPlugin) {

        super(app, plugin);

        this.plugin = plugin;

    }


    display(): void {

        const { containerEl } = this;


        containerEl.empty();


        containerEl.createEl('h2', { text: 'Settings for MyPlugin' });


        new Setting(containerEl)

            .setName('API Key')

            .setDesc('Enter your OpenAI API Key')

            .addText(text => text

                .setPlaceholder('Enter your key')

                .setValue(this.plugin.settings.apiKey)

                .onChange(async (value) => {

                    this.plugin.settings.apiKey = value;

                    await this.plugin.saveSettings();

                }));
                
        new Setting(containerEl)

            .setName('Max Tokens')

            .setDesc('Maximum number of tokens to generate.')

            .addText(text => text

                .setValue(String(this.plugin.settings.maxTokens))

                .onChange(async (value) => {

                    this.plugin.settings.maxTokens = parseInt(value) || 500;

                    await this.plugin.saveSettings();

                }));


        new Setting(containerEl)

            .setName('OpenAI Model')

            .setDesc('The model to use for completions.')

            .addText(text => text

                .setValue(this.plugin.settings.model)

                .onChange(async (value) => {

                    this.plugin.settings.model = value.trim();

                    await this.plugin.saveSettings();

                }));        

    }

}