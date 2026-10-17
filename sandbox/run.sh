#!/bin/bash
set -u
LANG_ID="${1:-}"
WORK="${WORK_DIR:-/work}"
COMPILE_TIMEOUT="${COMPILE_TIMEOUT:-15}"
RUN_TIMEOUT="${RUN_TIMEOUT:-5}"
MAX_SOURCE_BYTES=200000

case "$LANG_ID" in
    cpp)    SRC=main.cpp ;;
    c)      SRC=main.c ;;
    python) SRC=main.py ;;
    java)   SRC=Main.java ;;
    *) echo "Unsupported language: '$LANG_ID'" >&2; exit 2 ;;
esac

cd "$WORK" || { echo "sandbox: cannot enter dir" >&2; exit 2; }
head -c "$MAX_SOURCE_BYTES" > "$SRC"

compile() {
    timeout -k 1 "$COMPILE_TIMEOUT" "$@" >&2
    local rc=$?
    if [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; then
        echo "Compilation timed out after ${COMPILE_TIMEOUT}s" >&2
    fi
    [ "$rc" -eq 0 ] || exit 1
}

run() {
    timeout -k 1 "$RUN_TIMEOUT" "$@"
    local rc=$?
    case "$rc" in
        124|137) echo "Time limit exceeded (${RUN_TIMEOUT}s) or memory limit exceeded" >&2 ;;
        134)     echo "Program aborted (SIGABRT)" >&2 ;;
        139)     echo "Segmentation Fault" >&2 ;;
    esac
    exit "$rc"
}

case "$LANG_ID" in
    cpp)    compile g++ -O2 -std=c++17 main.cpp -o prog; run ./prog ;;
    c)      compile gcc -O2 main.c -o prog -lm;         run ./prog ;;
    python) run python3 main.py ;;
    java)   compile javac Main.java
            run java -Xmx128m -Xss512k -XX:+UseSerialGC Main ;;
esac