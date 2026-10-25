// Name: TurboWarp-Visual-Tracking
// ID: kubohiroyavisualtracking
// Description: Initial scaffold for visual-tracking.
// By: Hiroya Kubo
// License: MPL-2.0

(function (Scratch) {
  'use strict';

  //#region src/config.ts
  var extensionConfig = {
  	id: "kubohiroyavisualtracking",
  	slug: "visual-tracking",
  	name: "TurboWarp-Visual-Tracking",
  	description: "Initial scaffold for visual-tracking.",
  	author: "Hiroya Kubo",
  	license: "MPL-2.0",
  	unsandboxed: false,
  	docsURI: "https://kubohiroya.github.io/turbowarp-visual-tracking/",
  	blockIconURI: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzRDOTdGRiIgc3Ryb2tlLXdpZHRoPSIzLjYiLz48cGF0aCBkPSJNMjQgNXY3TTI0IDM2djdNNSAyNGg3TTM2IDI0aDciIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzRDOTdGRiIgc3Ryb2tlLXdpZHRoPSIzLjYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxjaXJjbGUgY3g9IjI0IiBjeT0iMjQiIHI9IjQiIGZpbGw9IiM1OUMwNTkiLz48L3N2Zz4="
  };
  var block_definitions_default = {
  	extensionName: "TurboWarp-Visual-Tracking",
  	blocks: [{
  		"opcode": "hello",
  		"blockType": "REPORTER",
  		"text": "hello [NAME]",
  		"description": "Returns a localized greeting for the supplied name.",
  		"arguments": { "NAME": {
  			"type": "STRING",
  			"defaultValue": "world"
  		} }
  	}]
  };
  //#endregion
  //#region src/extension.ts
  var blockDefinitions = block_definitions_default.blocks;
  var VisualTrackingExtension = class {
  	getInfo() {
  		return {
  			id: extensionConfig.id,
  			name: Scratch.translate(block_definitions_default.extensionName),
  			docsURI: extensionConfig.docsURI,
  			blockIconURI: extensionConfig.blockIconURI,
  			blocks: blockDefinitions.map((block) => this.toScratchBlock(block))
  		};
  	}
  	hello(args) {
  		return Scratch.translate({
  			default: "Hello, {name}!",
  			description: "{name} is replaced with the value supplied to the block."
  		}, { name: Scratch.Cast.toString(args.NAME) });
  	}
  	toScratchBlock(block) {
  		return {
  			opcode: block.opcode,
  			blockType: Scratch.BlockType[block.blockType],
  			text: Scratch.translate(block.text),
  			arguments: Object.fromEntries(Object.entries(block.arguments).map(([name, argument]) => [name, {
  				type: Scratch.ArgumentType[argument.type],
  				defaultValue: argument.defaultValue
  			}]))
  		};
  	}
  };
  //#endregion
  //#region src/index.ts
  if (extensionConfig.unsandboxed && !Scratch.extensions.unsandboxed) throw new Error(`${extensionConfig.name} must run unsandboxed.`);
  Scratch.extensions.register(new VisualTrackingExtension());
  //#endregion

})(Scratch);
