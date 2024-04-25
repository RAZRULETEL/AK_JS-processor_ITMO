import {Data, Instruction} from "../byte-code";

export class MemoryStorage {
    readonly memory_size: number;
    private storage: Array<Instruction | Data> = [];
    private readonly output: number;
    private readonly input: number;
    private input_buffer: number[] = [];

    constructor(memory_size: number, storage: {program: Array<Instruction | Data>, input: number, output: number}) {
        if (memory_size <= 0)
            throw new Error("Memory size must be greater than 0");
        this.memory_size = memory_size;
        this.storage = storage.program;
        if(storage.program.length < memory_size)
            this.storage = this.storage.concat(new Array<Instruction | Data>(memory_size - storage.program.length));
        this.output = storage.output;
        this.input = storage.input;
    }

    get(address: number): Instruction | Data {
        if (address < 0 || address >= this.memory_size)
            throw new Error(`Invalid address: ${address}`);
        if(address === this.input)
            return {value: this.input_buffer.shift() || 0};
        return this.storage[address];
    }

    set(address: number, value: Instruction | Data) {
        if (address < 0 || address >= this.memory_size)
            throw new Error(`Invalid address: ${address}`);
        if(address === this.output)
            if('value' in value)
                process.stdout.write(String.fromCharCode(value.value));
            else
                process.stdout.write(JSON.stringify(value));
        else
            this.storage[address] = value;
    }

    add_input(...input: number[]) {
        this.input_buffer.push(...input);
    }
}