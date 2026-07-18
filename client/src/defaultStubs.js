const stubs = {};

stubs.cpp = `#include<iostream>
#include<stdio.h>

using namespace std;

int main() {
    cout<<"hello c++\\n";
    return 0;
}
`;

stubs.python = `print("hello world")`;

stubs.c = `#include<stdio.h>

int main() {
    printf("hello c\\n");
    return 0;
}
`;

stubs.java = `public class Main {
    public static void main(String[] args) {
        System.out.println("hello java");
    }
}
`;

export default stubs;