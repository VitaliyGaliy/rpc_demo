import {mkdir, stat} from "fs";
export function makeDirIfNotExists(dirPath) {
    return new Promise((resolve, reject) => {
        stat(dirPath, (err,stats) => {
            if (!err && !!stats) {
                resolve()
            }
            else {
                mkdir(dirPath, { recursive: true }, (err) => {
                    if (err) {
                        reject(err)
                    }
                    resolve()
                })
            }
        })
    });
}