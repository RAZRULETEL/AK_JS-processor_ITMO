import {Address, Opcode, Register} from "../byte-code";
import {AluOperation} from "./alu";
// eslint-disable-next-line sort-imports
import {
    Flags,
    JMP_CHECK_CONDITION,
    OPERANDS_REQUIRES_DATA_FETCH,
    ProcessorRegisters,
    ProcessorState
} from "./processor-types";
import {MemoryStorage} from "./memory";


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

    private alu_operation = AluOperation.alu_operation_fabric(this);

    latch_instruction_pointer(operation: AluOperation | undefined = undefined) {
        if(operation){
            this.registers.IP = operation.execute();
            this.tick();
            return;
        }

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

    latch_accumulator(operation: AluOperation){
        this.registers.ACC = operation.execute();
        this.tick();
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

    latch_buffer_register(operation: AluOperation) {
        this.registers.IP = operation.execute();
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

    fetch_instruction(){
        if(this.state !== ProcessorState.FetchingInstruction)
            throw new Error(`Processor have incorrect state: ${this.state}`);
        this.latch_data_register()
        this.latch_program_register();
        this.state = ProcessorState.FetchingData;
    }

    fetch_data(){
        if(this.state !== ProcessorState.FetchingData)
            throw new Error(`Processor have incorrect state: ${this.state}`);
        if(!this.registers.PR)
            throw new Error("Processor have no instruction fetched");
        if(OPERANDS_REQUIRES_DATA_FETCH.includes(this.registers.PR.opcode)) {
            const instruction = this.registers.PR;
            if (instruction.opcode === Opcode.POP || typeof instruction.arg === 'object') {

                let arg: Address = {addressing: 'absolute', value: 0};
                if (instruction.opcode !== Opcode.POP)
                    if (typeof instruction.arg === 'object')
                        if('addressing' in instruction.arg)
                            arg = instruction.arg;
                        else
                            throw new Error("Invalid instruction");

                this.latch_buffer_register(this.alu_operation(Register.IP));
                if(instruction.opcode === Opcode.POP){
                    this.latch_instruction_pointer(this.alu_operation(Register.SP, Register.ZR, Opcode.DEC));
                }else
                    switch(arg.addressing) {
                        case "relative":
                            this.latch_instruction_pointer(this.alu_operation(Register.IP, arg.value));
                        break;
                        case "stack":
                            this.latch_instruction_pointer(this.alu_operation(Register.SP, arg.value));
                            break;
                        case "absolute":
                        default:
                            this.latch_instruction_pointer(this.alu_operation(Register.ZR, arg.value));
                            break;
                    }

                this.latch_data_register();
                this.latch_instruction_pointer(this.alu_operation(Register.BR));
                this.latch_buffer_register(this.alu_operation(Register.BR))
            }else{// direct load
                this.latch_buffer_register(this.alu_operation(Register.ZR, instruction.arg));
            }
        }
        this.state = ProcessorState.Executing;
    }

}