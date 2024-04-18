import {Data, Instruction} from "./byte-code";
import {Flags, JMP_CHECK_CONDITION, ProcessorState} from "./processor-types";


class MemoryStorage {
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

class Proccessor {
    private registers = {
        ACC: 0,
        IP: 0,
        SP: 0,
        BR: 0
    };
    private flags: Flags = {
        Zero: 0,
        Carry: 0,
        Negative: 0,
        Overflow: 0
    }
    private storage: MemoryStorage;
    private state: ProcessorState = ProcessorState.Uninitialized;

    private time: number = 0; // tick counter
    tick() {
        this.time++;
    }

    constructor(storage: MemoryStorage) {
        this.storage = storage;
    }

    latch_instruction_pointer(instruction: Instruction) {
        this.registers.IP++;
        if ((typeof instruction.arg) === 'object' // @ts-expect-error TS don't recognize instruction.arg is object check
            && "addressing" in instruction.arg
            && JMP_CHECK_CONDITION[instruction.arg.value] && JMP_CHECK_CONDITION[instruction.arg.value](this.flags)) {
            if (instruction.arg.addressing === "relative")
                this.registers.IP += instruction.arg.value;
            else if (instruction.arg.addressing === "absolute")
                this.registers.IP = instruction.arg.value;
            else
                throw new Error(`Invalid addressing: ${instruction.arg.addressing}`);
        }
    }

    zero() {
        return this.flags.Zero;
    }


}