import {Data, Instruction} from "../byte-code";

export class MemoryStorage {
    memory_size: number = 0;
    storage: Array<Instruction | Data> = [];

    constructor(memory_size: number, storage: Array<Instruction | Data>) {
        if (memory_size <= 0)
            throw new Error("Memory size must be greater than 0");
        this.memory_size = memory_size;
        this.storage = storage;
    }

    get(address: number): Instruction | Data {
        if (address < 0 || address >= this.memory_size)
            throw new Error("Invalid address");
        return this.storage[address];
    }

    set(address: number, value: Instruction | Data) {
        if (address < 0 || address >= this.memory_size)
            throw new Error("Invalid address");
        this.storage[address] = value;
    }
}