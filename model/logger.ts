import {LogLevel} from "./processor-types";


export class Logger{
    private readonly level: LogLevel;
    private readonly log_output: string[] = [];
    constructor(level: LogLevel) {
        this.level = level;
    }

    log(message: string, level: LogLevel): void {
        if(level === this.level || LogLevel.Any === level)
            this.log_output.push(message);
    }

    get_log(): string[] {
        return this.log_output;
    }
}