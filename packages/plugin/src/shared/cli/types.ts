export type CommandSpecOption = {
	key: string;
	value?: string;
	description: string;
	required?: boolean;
};

export type CommandSpec = {
	name: string;
	summary: string;
	synopsis?: string[];
	description: string[];
	options: CommandSpecOption[];
	examples?: string[];
	notes?: string[];
	seeAlso?: string[];
};

export type CliFlagDefinition = {
	value?: string;
	description: string;
	required?: boolean;
};
