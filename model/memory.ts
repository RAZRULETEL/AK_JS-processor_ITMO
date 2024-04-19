import {Data, Instruction} from "../byte-code";

export class MemoryStorage {
    private readonly memory_size: number;
    private storage: Array<Instruction | Data> = [];
    private readonly output: number;
    private readonly input: number;
    private input_buffer: number[];

    constructor(memory_size: number, storage: Array<Instruction | Data>, io: {input: number, output: number}) {
        if (memory_size <= 0)
            throw new Error("Memory size must be greater than 0");
        this.memory_size = memory_size;
        this.storage = storage;
        if(storage.length < memory_size)
            this.storage = this.storage.concat(new Array<Instruction | Data>(memory_size - storage.length));
        this.output = io.output;
        this.input = io.input;
    }

    get(address: number): Instruction | Data {
        if (address < 0 || address >= this.memory_size)
            throw new Error("Invalid address");
        if(address === this.input)
            return {value: this.input_buffer.shift() || 0};
        return this.storage[address];
    }

    set(address: number, value: Instruction | Data) {
        if (address < 0 || address >= this.memory_size)
            throw new Error("Invalid address");
        if(address === this.output)
            if('value' in value)
                console.info(value.value);
            else
                console.info(value);
        else
            this.storage[address] = value;
    }

    add_input(...input: number[]) {
        this.input_buffer.push(...input);
    }
}