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
import {SourceProgram} from "../translator-types";
import fs from "fs";


export const REGISTER_BITS_SIZE = 32;
const INPUT_FILE_ARG = 2;
const STDIN_FILE_ARG = 3;
const TIME_LIMIT_ARG = 4;

const MEMORY_SIZE = 1024;
const PROB1_TIME_LIMIT = 1_000_000;




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
        if(register === Register.DR && "value" in this.registers.DR) return this.registers.DR.value;
        return <number>this.registers[register];
    }

    private alu_operation = AluOperation.alu_operation_fabric(this);

    private latch_instruction_pointer(operation: AluOperation | undefined = undefined) {
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
            && ((JMP_CHECK_CONDITION[instruction.opcode]
            && JMP_CHECK_CONDITION[instruction.opcode](this.flags))
            || (instruction.opcode === Opcode.JMP && this.registers.ZR === 0))
        ) {
                if (instruction.arg.addressing === "relative")
                    this.registers.IP += instruction.arg.value;
                else if (instruction.arg.addressing === "absolute")
                    this.registers.IP = instruction.arg.value;
                else
                    throw new Error(`Invalid addressing fot jmp: ${instruction.arg.addressing}`);
        }
        this.tick();
    }

    private latch_data_register(){
        this.registers.DR = this.storage.get(this.registers.IP);
        this.tick();
    }

    private latch_memory(operation: AluOperation){
        this.storage.set(this.registers.IP, {value: operation.execute()});
    }

    private latch_accumulator(operation: AluOperation, set_flags: boolean = false){
        this.registers.ACC = operation.execute();
        if(set_flags)
            this.flags = operation.get_flags();
        this.tick();
    }

    private latch_stack_pointer(){
        if(this.registers.PR) {
            switch (this.registers.PR.opcode) {
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
            if(this.registers.SP < 0)
                this.registers.SP = this.storage.memory_size + this.registers.SP;
            else if(this.registers.SP >= this.storage.memory_size)
                this.registers.SP %= this.storage.memory_size;
        }
        this.tick();
    }

    private latch_buffer_register(operation: AluOperation) {
        this.registers.BR = operation.execute();
        this.tick();
    }

    private latch_program_register(){
        const instruction = this.registers.DR;
        if("opcode" in instruction)
            this.registers.PR = instruction;
        else
            throw new Error("Not implemented!"); // TODO: implement data conversion
        this.tick();
    }

    private fetch_instruction(){
        if(this.state !== ProcessorState.FetchingInstruction)
            throw new Error(`Processor have incorrect state: ${this.state}`);
        this.latch_data_register()
        this.latch_program_register();
        this.state = ProcessorState.FetchingData;
    }

    private fetch_data(){
        if(this.state !== ProcessorState.FetchingData)
            throw new Error(`Processor have incorrect state: ${this.state}`);
        if(!this.registers.PR)
            throw new Error("Processor have no instruction fetched");
        if(OPERANDS_REQUIRES_DATA_FETCH.includes(this.registers.PR.opcode)) {
            const instruction = this.registers.PR;
            if (instruction.opcode === Opcode.POP || typeof instruction.arg === 'object') {

                this.latch_buffer_register(this.alu_operation(Register.IP));
                if(instruction.opcode === Opcode.POP){
                    this.latch_instruction_pointer(this.alu_operation(Register.SP));
                }else
                    this.latch_instruction_pointer(this.fetch_instruction_address());

                this.latch_data_register();
                this.latch_instruction_pointer(this.alu_operation(Register.BR));
                this.latch_buffer_register(this.alu_operation(Register.DR))
            }else{// direct load
                this.latch_buffer_register(this.alu_operation(Register.ZR, instruction.arg));
            }
        }
        this.state = ProcessorState.Executing;
    }

    // eslint-disable-next-line max-statements
    private execute(){
        if(this.state !== ProcessorState.Executing)
            throw new Error(`Processor have incorrect state: ${this.state}`);
        if(!this.registers.PR)
            throw new Error("Processor have no instruction fetched");

        const opcode = this.registers.PR.opcode;

        if (opcode === Opcode.HALT) {
            this.state = ProcessorState.Halted;
            return;
        }

        if(![Opcode.CMP, Opcode.LD, Opcode.POP].includes(opcode) && OPERANDS_REQUIRES_DATA_FETCH.includes(opcode))
            this.latch_accumulator(this.alu_operation(Register.ACC, Register.BR, opcode), true);

        if(opcode === Opcode.LD || opcode === Opcode.POP)
            this.latch_accumulator(this.alu_operation(Register.BR), false);

        if(opcode === Opcode.INC || opcode === Opcode.DEC)
            this.latch_accumulator(this.alu_operation(Register.ACC, Register.ZR, opcode), true);

        if(opcode === Opcode.CMP) {
            this.flags = this.alu_operation(Register.ACC, Register.BR, Opcode.SUB).get_flags();
            this.tick();
        }

        if(opcode === Opcode.RET){
            this.latch_instruction_pointer(this.alu_operation(Register.SP));
            this.latch_data_register();
            this.latch_instruction_pointer(this.alu_operation(Register.DR));
        }

        if(STACK_OPERANDS.includes(opcode))
            this.latch_stack_pointer();

        if(opcode === Opcode.CALL){
            this.latch_buffer_register(this.alu_operation(Register.IP));
            this.latch_instruction_pointer(this.alu_operation(Register.SP));
            this.latch_memory(this.alu_operation(Register.BR));
            this.latch_instruction_pointer(this.fetch_instruction_address());
        }

        this.state = ProcessorState.WritingData;
    }

    private write_data(){
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

    private fetch_instruction_address(): AluOperation{
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
            throw new Error("Instruction must have Address arg");
    }

    get_state(): string{
        const flags = `N: ${this.flags.Negative} Z: ${this.flags.Zero} V: ${this.flags.Overflow} C: ${this.flags.Carry}`;
        return `t: ${this.time}, state: ${this.state}, IP: ${this.registers.IP}, PR: ${this.registers.PR?.opcode || "none"} ACC: ${this.registers.ACC}, BR: ${this.registers.BR}, SP: ${this.registers.SP}, ZR: ${this.registers.ZR}, ${flags}`
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
            if(this.time >= time_limit)
                console.warn(`Time limit reached. ${this.get_state()}`);
        }catch (err: unknown) {
            console.log(this.get_state())
            console.error(`Simulation failed: ${(err as Error).message}`);
        }
    }
}


const program_code_file = process.argv[INPUT_FILE_ARG];
if(program_code_file) {
    if(fs.existsSync(program_code_file)) {
        if(!process.argv[STDIN_FILE_ARG] || fs.existsSync(process.argv[STDIN_FILE_ARG])) {
            const input_data = JSON.parse(fs.readFileSync(program_code_file, 'utf8')) as SourceProgram;
            const stdin = process.argv[STDIN_FILE_ARG] ? fs.readFileSync(process.argv[STDIN_FILE_ARG], 'utf8') : "";
            const time_limit = process.argv[TIME_LIMIT_ARG] ? +process.argv[TIME_LIMIT_ARG] : PROB1_TIME_LIMIT

            simulate(input_data, stdin, time_limit);
        }else
            console.error(`File ${process.argv[STDIN_FILE_ARG]} does not exists!`);
    }else
        console.error(`File ${program_code_file} does not exists!`);

}

export function simulate(program: SourceProgram, stdin: string, time_limit: number) {
    const memory = new MemoryStorage(MEMORY_SIZE, program);
    memory.add_input(...stdin.split("").map(char => char.charCodeAt(0)));
    const processor = new Processor(memory);
    processor.start_simulation(time_limit);
}