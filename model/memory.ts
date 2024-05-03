import {Data, Instruction, instruction_to_data} from "../byte-code";

export class MemoryStorage {
    readonly memory_size: number;
    protected storage: Array<Instruction | Data> = [];
    protected readonly output: number;
    protected readonly input: number;
    protected input_buffer: number[] = [];
    protected output_buffer: number[] = [];

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

    get(address: number, time_callback: () => void): Instruction | Data {
        if (address < 0 || address >= this.memory_size)
            throw new Error(`Invalid address: ${address}`);
        if (address === this.input) {
            const value = this.input_buffer.shift();
            if (value)
                return {value};
            throw new Error("Input buffer is empty");
        }
        time_callback();
        return this.storage[address];
    }

    set(address: number, value: Instruction | Data) {
        if (address < 0 || address >= this.memory_size)
            throw new Error(`Invalid address: ${address}`);
        if(address === this.output)
            if('value' in value)
                this.output_buffer.push(value.value);
            else
                this.output_buffer.push(instruction_to_data(value).value);
        else
            this.storage[address] = value;
    }

    add_input(...input: number[]) {
        this.input_buffer.push(...input);
    }

    get_output(): number[] {
        return this.output_buffer;
    }
}