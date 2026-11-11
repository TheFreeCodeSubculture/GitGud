//! The same Rust the Tauri build runs for Git, folder listing and shell history.
//! The sources are included from src-tauri, not copied.
//!
//! Every call runs on the libuv thread pool and returns a Promise, as a Tauri
//! command does: a synchronous `git` would freeze the UI thread (and every
//! animation timer) for as long as Git takes.
#![allow(dead_code)]
use napi::{bindgen_prelude::AsyncTask, Env, Error, JsUnknown, Result, Task};
use napi_derive::napi;
use serde_json::{json, Value};

#[path = "../../../src-tauri/src/git.rs"]
mod git;
#[path = "../../../src-tauri/src/shell.rs"]
mod shell;

pub struct Job(Option<Box<dyn FnOnce() -> std::result::Result<Value, String> + Send>>);

impl Task for Job {
    type Output = Value;
    type JsValue = JsUnknown;
    fn compute(&mut self) -> Result<Value> {
        (self.0.take().expect("job runs once"))().map_err(Error::from_reason)
    }
    fn resolve(&mut self, env: Env, out: Value) -> Result<JsUnknown> {
        env.to_js_value(&out)
    }
}

fn job(f: impl FnOnce() -> std::result::Result<Value, String> + Send + 'static) -> AsyncTask<Job> {
    AsyncTask::new(Job(Some(Box::new(f))))
}

/// `(args, cwd?)` -> Promise<`{stdout, stderr, code}`>
#[napi(js_name = "runGit", ts_return_type = "Promise<unknown>")]
pub fn run_git(args: Vec<String>, cwd: Option<String>) -> AsyncTask<Job> {
    job(move || git::run(&args, cwd.as_deref()).map(|o| json!(o)))
}

/// `path` -> Promise<`[{name, is_dir}]`>
#[napi(js_name = "listDir", ts_return_type = "Promise<unknown>")]
pub fn list_dir(path: String) -> AsyncTask<Job> {
    job(move || shell::list_dir(&path).map(|e| json!(e)))
}

/// `home` -> Promise<`[{shell, path, commands}]`>
#[napi(js_name = "shellHistory", ts_return_type = "Promise<unknown>")]
pub fn shell_history(home: String) -> AsyncTask<Job> {
    job(move || Ok(json!(shell::history(std::path::Path::new(&home)))))
}
