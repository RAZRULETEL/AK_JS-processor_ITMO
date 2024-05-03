import {Data, Instruction, instruction_to_data} from "../byte-code";
import {MemoryStorage} from "./memory";

const MEMORY_ACCESS_TIME = 10;

export class MemoryStorageCache extends MemoryStorage {

    private readonly cache_lines: number;
    private readonly cache: Map<number, Instruction | Data> = new Map();

    constructor(memory_size: number, storage: {program: Array<Instruction | Data>, input: number, output: number}, cache_lines: number) {
        super(memory_size, storage);
        this.cache_lines = cache_lines;
    }

    get(address: number, time_callback: () => void): Instruction | Data {
        if (address < 0 || address >= this.memory_size)
            throw new Error(`Invalid address: ${address}`);
        if (address === this.input) {
            for (let time = 0; time < MEMORY_ACCESS_TIME; time++) time_callback();
            const value = this.input_buffer.shift();
            if (value)
                return {value};
            throw new Error("Input buffer is empty");
        }
        const cell = this.cache.get(address);
        if (cell) {
            time_callback();
            return cell;
        }
        for (let time = 0; time < MEMORY_ACCESS_TIME; time++) time_callback();
        if(this.cache.size >= this.cache_lines){
            const keys = [...this.cache.keys()];
            this.cache.delete(keys[Math.random() * keys.length | 0]);
        }
        this.cache.set(address, this.storage[address]);
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
        else {
            if (this.cache.has(address))
                this.cache.set(address, value);
            this.storage[address] = value;
        }
    }
}