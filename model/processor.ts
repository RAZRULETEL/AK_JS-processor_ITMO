import {
    Flags,
    JMP_CHECK_CONDITION,
    OPERANDS_REQUIRES_DATA_FETCH,
    ProcessorRegisters,
    ProcessorState,
    STACK_OPERANDS
} from "./processor-types";
import {Opcode, Register} from "../byte-code";
import {AluOperation} from "./alu";
import {MemoryStorage} from "./memory";

export const REGISTER_BITS_SIZE = 32;


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
                    throw new Error(`Invalid addressing fot jmp: ${instruction.arg.addressing}`);
        }
        this.tick();
    }

    latch_data_register(){
        this.registers.DR = this.storage.get(this.registers.IP);
        this.tick();
    }

    latch_memory(operation: AluOperation){
        this.storage.set(this.registers.IP, {value: operation.execute()});
    }

    latch_accumulator(operation: AluOperation, set_flags: boolean = false){
        this.registers.ACC = operation.execute();
        if(set_flags)
            this.flags = operation.get_flags();
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

                this.latch_buffer_register(this.alu_operation(Register.IP));
                if(instruction.opcode === Opcode.POP){
                    this.latch_instruction_pointer(this.alu_operation(Register.SP, Register.ZR, Opcode.DEC));
                }else
                    this.latch_instruction_pointer(this.fetch_instruction_address());

                this.latch_data_register();
                this.latch_instruction_pointer(this.alu_operation(Register.BR));
                this.latch_buffer_register(this.alu_operation(Register.BR))
            }else{// direct load
                this.latch_buffer_register(this.alu_operation(Register.ZR, instruction.arg));
            }
        }
        this.state = ProcessorState.Executing;
    }

    // eslint-disable-next-line max-statements
    execute(){
        if(this.state !== ProcessorState.Executing)
            throw new Error(`Processor have incorrect state: ${this.state}`);
        if(!this.registers.PR)
            throw new Error("Processor have no instruction fetched");

        const opcode = this.registers.PR.opcode;

        if (opcode === Opcode.HALT) {
            this.state = ProcessorState.Halted;
            return;
        }

        if(opcode !== Opcode.CMP && OPERANDS_REQUIRES_DATA_FETCH.includes(opcode))
            this.latch_accumulator(this.alu_operation(Register.BR, Register.ACC, opcode)
                , ![Opcode.LD, Opcode.POP].includes(opcode));

        if(opcode === Opcode.INC || opcode === Opcode.DEC)
            this.latch_accumulator(this.alu_operation(Register.ACC, Register.ZR, opcode), true);

        if(opcode === Opcode.CMP) {
            this.flags = this.alu_operation(Register.ACC, Register.BR, Opcode.SUB).get_flags();
            this.tick();
        }

        if(opcode === Opcode.CALL){
            this.latch_buffer_register(this.alu_operation(Register.IP));
            this.latch_instruction_pointer(this.alu_operation(Register.SP));
            this.latch_memory(this.alu_operation(Register.BR));
            this.latch_instruction_pointer(this.fetch_instruction_address());
        }

        if(opcode === Opcode.RET){
            this.latch_instruction_pointer(this.alu_operation(Register.SP, 1, Opcode.SUB));
            this.latch_data_register();
            this.latch_instruction_pointer(this.alu_operation(Register.DR));
        }

        if(STACK_OPERANDS.includes(opcode))
            this.latch_stack_pointer();

        this.state = ProcessorState.WritingData;
    }

    write_data(){
        if(this.state !== ProcessorState.WritingData)
            throw new Error(`Processor have incorrect state: ${this.state}`);
        if(!this.registers.PR)
            throw new Error("Processor have no instruction fetched");

        if(this.registers.PR.opcode === Opcode.PUSH){
            this.latch_buffer_register(this.alu_operation(Register.IP));
            this.latch_instruction_pointer(this.alu_operation(Register.SP));
            this.latch_memory(this.alu_operation(Register.ACC));
            this.latch_instruction_pointer(this.alu_operation(Register.BR));
        }

        if(this.registers.PR.opcode === Opcode.ST){
            this.latch_buffer_register(this.alu_operation(Register.IP));
            this.latch_instruction_pointer(this.fetch_instruction_address());
            this.latch_memory(this.alu_operation(Register.ACC));
            this.latch_instruction_pointer(this.alu_operation(Register.BR));
        }

        this.state = ProcessorState.FetchingInstruction;
    }

    fetch_instruction_address(): AluOperation{
        if(!this.registers.PR)
            throw new Error("Processor have no instruction fetched");
        if((typeof this.registers.PR.arg === 'object') && "addressing" in this.registers.PR.arg)
            if(this.registers.PR.arg.addressing === "relative")
                return this.alu_operation(Register.BR, this.registers.PR.arg.value);
            else if(this.registers.PR.arg.addressing === "absolute")
                return this.alu_operation(Register.ZR, this.registers.PR.arg.value);
            else
                return this.alu_operation(Register.SP, this.registers.PR.arg.value);
        else
            throw new Error("Call instruction must have Address arg");
    }
    
    start_simulation(time_limit: number) {
        try {
            while (this.time < time_limit) {
                this.state = ProcessorState.FetchingInstruction;
                this.fetch_instruction();
                this.fetch_data();
                this.execute();
                // @ts-expect-error TS don't know that state changes in functions
                if (this.state === ProcessorState.Halted)
                    break;
                this.write_data();
                this.latch_instruction_pointer();
            }
        }catch (err: unknown) {
            console.error(`Simulation failed: ${(err as Error).message}`);
        }
    }
}