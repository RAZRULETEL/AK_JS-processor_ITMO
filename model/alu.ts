import {Opcode, Register} from "../byte-code";
import {Processor, REGISTER_BITS_SIZE} from "./processor";
import {Flags} from "./processor-types";

const RADIX = 2;

const OPCODE_MATH_OPERATIONS: {[key: number]: (val1: number, val2: number) => number} = {
    [Opcode.ADD]: (val1, val2) => val1 + val2,
    [Opcode.SUB]: (val1, val2) => val1 - val2,
    [Opcode.MUL]: (val1, val2) => val1 * val2,
    [Opcode.DIV]: (val1, val2) => val1 / val2,
    [Opcode.MOD]: (val1, val2) => val1 % val2,
    [Opcode.DEC]: (val1) => val1 - 1,
    [Opcode.INC]: (val1) => val1 + 1,
    [Opcode.LD]: (val1) => val1,
    [Opcode.POP]: (val1) => val1
}

export class AluOperation {
    private readonly reg1: Register;
    private readonly reg2: Register | number;
    private readonly operation: Opcode;
    private processor: Processor;
    private constructor(reg1: Register, reg2: Register | number, operation: Opcode = Opcode.ADD) {
        this.reg1 = reg1;
        this.reg2 = reg2;
        if(reg1 === reg2)
            throw new Error(`Alu can't operate on same register: ${reg1}`);
        if(OPCODE_MATH_OPERATIONS[operation] === undefined)
            throw new Error(`Invalid math operation: ${operation}`);
        this.operation = operation;
    }


    execute(): number{
        const val1 = this.processor.get_register(this.reg1);
        const val2 = typeof this.reg2 === "number" ? this.reg2 : this.processor.get_register(this.reg2);
        return OPCODE_MATH_OPERATIONS[this.operation](val1, val2);
    }

    get_flags(): Flags {
        const val = this.execute();
        const carry = +(val > (RADIX ** REGISTER_BITS_SIZE - 1) || val < -(RADIX ** REGISTER_BITS_SIZE));
        const overflow = +(val < -(RADIX ** REGISTER_BITS_SIZE) || val > (RADIX ** REGISTER_BITS_SIZE - 1));

        return {
            Zero: +(!!val),
            Carry: carry,
            Negative: +(val < 0),
            Overflow: overflow
        };
    }

    static alu_operation_fabric(processor: Processor):
        (reg1: Register, reg2?: Register | number, operation?: Opcode) => AluOperation {
        return (reg1: Register, reg2: Register | number = Register.ZR, operation: Opcode = Opcode.ADD) => {
            const res = new AluOperation(reg1, reg2, operation);
            res.processor = processor;
            return res;
        }
    }

    static is_math_instruction(opcode: Opcode): boolean {
        return OPCODE_MATH_OPERATIONS[opcode] !== undefined
    }
}
