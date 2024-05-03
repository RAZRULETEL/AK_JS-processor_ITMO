import * as Crypto from "crypto";
import * as fs from "fs";
import {SourceProgram} from "./translator-types";
import {execSync} from "child_process";


interface GoldenTestConfig {
    input_lisp: string[];
    output_json: SourceProgram;
    input_stdin: string;
    output_stdout: string;
    output_log_path: string;
}
const TIMEOUT = 10_000;
const MAX_JOURNAL_LENGTH = 20_000;

const TEST_TEMP_DIR = 'tmp';
const TEST_PROCESSOR_TIME_LIMIT = 1_000_000;

const TRANSLATOR_PATH = "./translator.js";
const PROCESSOR_PATH = "./model/processor.js";

describe('Running golden tests', () => {
    it.each([
        "tests/hello.json",
        "tests/cat.json",
        "tests/hello_user.json",
        "tests/prob1.json",
        "tests/factorial.json"
    ])(`from file %p`, async (test_config: string) => {
        const config = JSON.parse(fs.readFileSync(test_config, "utf8")) as GoldenTestConfig;

        const TEMP_DIR = `tmp/test_${Crypto.randomUUID()}`;
        const OUTPUT_SOURCE = `${TEMP_DIR}/output.json`;
        const INPUT_STDIN = `${TEMP_DIR}/input`;
        const OUTPUT_LOG = `${TEMP_DIR}/output`;

        try {
            await fs.promises.mkdir(TEMP_DIR, { recursive: true });
        }catch (err) {
            // ignore, directory already exists
        }

        await fs.promises.writeFile(`${TEMP_DIR}/input.lisp`, config.input_lisp.join(""));
        await fs.promises.writeFile(INPUT_STDIN, config.input_stdin);

        execSync(`node ${TRANSLATOR_PATH} ${TEMP_DIR}/input.lisp ${OUTPUT_SOURCE}`);
        expect(JSON.parse(await fs.promises.readFile(OUTPUT_SOURCE, 'utf8'))).toEqual(config.output_json);

        const stdout = execSync(`node ${PROCESSOR_PATH} ${OUTPUT_SOURCE} ${INPUT_STDIN} ${OUTPUT_LOG} ${TEST_PROCESSOR_TIME_LIMIT}`);
        expect(stdout.toString()).toEqual(config.output_stdout);

        const log = (await fs.promises.readFile(OUTPUT_LOG, 'utf8')).split("\n", MAX_JOURNAL_LENGTH).join("\n");
        const target_log = await fs.promises.readFile(config.output_log_path, 'utf8');
        expect(log).toEqual(target_log);

        await fs.promises.rm(TEMP_DIR, { recursive: true, force: true });
        try {
            await fs.promises.rmdir(TEST_TEMP_DIR);
        }catch (err) {
            // ignore, not last test
        }
    }, TIMEOUT)
});

