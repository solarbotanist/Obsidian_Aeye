import { Plugin, MarkdownView, PluginSettingTab, App, Setting, TFile } from 'obsidian';

import OpenAI from "openai";



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

	private ribbonIcon: HTMLElement | null = null;

	private statusMessage: HTMLElement | null = null;

	private showLoader(message: string): void {

		this.ribbonIcon = this.addRibbonIcon('dots-three-horizontal', message, (evt: MouseEvent) => {
	
		});

		this.ribbonIcon.addClass('my-plugin-loading');

		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

    if (activeView) {

        this.statusMessage = activeView.containerEl.createDiv('status-message');

        this.statusMessage.setText(`${message} 🕵️`);

    }

}

private hideLoader(): void {

    if (this.ribbonIcon) {

        this.ribbonIcon.remove();

        this.ribbonIcon = null;

    }


    if (this.statusMessage) {

        this.statusMessage.remove();

        this.statusMessage = null;

    }

}



    async onload() {

        await this.loadSettings();

        this.addCommand({

            id: 'Use_Aeye_selected_text',

            name: 'Use Aeye with selected text as prompt',

            callback: () => this.convertImageToSend(),

        });


        this.addSettingTab(new SettingTab(this.app, this));

    }


    onunload() { 
		this.hideLoader();
	}


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

		for (let i = selectedLineNumber - 1; i >= 0; i--) {

			const line = lines[i];

			const embedRegex = /!\[\[(.*?)\]\]/;

			const matchResult = line.match(embedRegex);


			if (matchResult && matchResult.length > 1) {

				const imagePath = matchResult[1];

				try {

					base64Image = await this.convertImageToBase64(imagePath);

					break;

				} catch (error) {

					console.error('Error while converting image to base64:', error);

					return;

				}

			}

		}


        if (!base64Image) {

            console.error('No image found above selected text');

            return;

        }


        const openai = new OpenAI({ apiKey: this.settings.apiKey, dangerouslyAllowBrowser: true });

        try {

			this.showLoader("Eye spy");

            const response = await openai.chat.completions.create({

                model: "gpt-4-vision-preview",

				max_tokens: 500,

                messages: [

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

			this.insertTextBelowSelection(editor, `${response.choices[0].message.content} \n`);

		} catch (error) {

			console.error('API call failed:', error);

		}finally {

			this.hideLoader();
		}

    }


	insertTextBelowSelection(editor: CodeMirror.Editor, textToInsert: string): void {

		const cursor = editor.getCursor('to');

		if (cursor.line === editor.lastLine()) {

			editor.replaceRange(`\n${textToInsert}`, cursor);

		} else {

			const position = { line: cursor.line + 1, ch: 0 };

			editor.replaceRange(`${textToInsert}\n`, position);

		}

		editor.setCursor({ line: cursor.line + 1, ch: 0 });

	}


	async convertImageToBase64(imagePath: string): Promise<string> {

		let file = this.app.vault.getAbstractFileByPath(imagePath);

		if (!file) {

			file = this.app.metadataCache.getFirstLinkpathDest(imagePath, '');

		}

		if (file instanceof TFile) {

			const arrayBuffer = await this.app.vault.readBinary(file);
	
			const base64String = arrayBufferToBase64(arrayBuffer);
	
			const mimeType = this.getMimeType(file.extension);
	
			return `data:${mimeType};base64,${base64String}`;
	
		} else {
	
			throw new Error(`No file found for image path "${imagePath}".`);
	
		}
	
	}
	
	
	getMimeType(extension: string): string {
	
		const mimeTypes: { [key: string]: string } = {
	
			'jpg': 'image/jpeg',
	
			'jpeg': 'image/jpeg',
	
			'png': 'image/png',
	
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