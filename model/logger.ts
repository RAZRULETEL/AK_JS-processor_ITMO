import {LogLevel} from "./processor-types";


export class Logger{
    private readonly level: LogLevel;
    constructor(level: LogLevel) {
        this.level = level;
    }

    log(message: string, level: LogLevel): void {
        if(level === this.level)
            console.log(message);
    }
}