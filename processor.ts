import {Address, Opcode, Register} from "./byte-code";
// eslint-disable-next-line sort-imports
import {
    Flags,
    JMP_CHECK_CONDITION,
    OPERANDS_REQUIRES_DATA_FETCH,
    ProcessorRegisters,
    ProcessorState,
    STACK_OPERANDS
} from "./processor-types";
import {MemoryStorage} from "./model/memory";


export class Processor {
    private registers: ProcessorRegisters = {
        ACC: 0,
        IP: 0,
        SP: 0,
        BR: 0,
        DR: {value: 0},
        PR: null,
        ZR: 0 // always zero
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

    constructor(storage: MemoryStorage) {
        this.storage = storage;
    }

    tick() {
        this.time++;

    }

    zero() {
        return this.registers.ZR;
    }

    get_register(register: Register): number {
        return <number>this.registers[register];
    }

    latch_instruction_pointer(instruction: Instruction) {
        this.registers.IP++;
        const instruction = this.registers.PR;
        if (instruction &&
            (typeof instruction.arg === 'object')
            && "addressing" in instruction.arg
            && JMP_CHECK_CONDITION[instruction.arg.value]
            && JMP_CHECK_CONDITION[instruction.arg.value](this.flags)) {
                if (instruction.arg.addressing === "relative")
                    this.registers.IP += instruction.arg.value;
                else if (instruction.arg.addressing === "absolute")
                    this.registers.IP = instruction.arg.value;
                else
                    throw new Error(`Invalid addressing: ${instruction.arg.addressing}`);
        }
        this.tick();
    }

    latch_data_register(){
        this.registers.DR = this.storage.get(this.registers.IP);
        this.tick();
    }

    zero() {
        return this.flags.Zero;
    }

    latch_stack_pointer(){
        if(this.registers.PR)
            switch (this.registers.PR.opcode){
                case Opcode.POP:
                case Opcode.FLUSH:
                case Opcode.RET:
                    this.registers.SP++;
                break;
                case Opcode.PUSH:
                case Opcode.CALL:
                default:
                    this.registers.SP--;
                break;
            }
        this.tick();
    }

    latch_program_register(){
        const instruction = this.registers.DR;
        if("opcode" in instruction)
            this.registers.PR = instruction;
        else
            throw new Error("Not implemented!"); // TODO: implement data conversion
        this.tick();
    }

}