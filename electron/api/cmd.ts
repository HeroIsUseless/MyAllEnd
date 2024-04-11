import child_process from 'child_process';
const exec = child_process.exec;

export function runExec(cmdStr: string, cmdPath?: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const cwd = cmdPath || undefined;
        const workerProcess = exec(cmdStr, { cwd });
        workerProcess.stdout!.on('data', function (data: string) {
            console.log('【exec】success: ' + data);
            resolve(data);
        });
    
        workerProcess.stderr!.on('data', function (data: string) {
            console.log('【exec】err: ' + data);
            reject(data);
        });
    
        workerProcess.on('close', function (code: string) {
            console.log('【exec】close: ' + code);
            // resolve(code);
        })
    });
}
