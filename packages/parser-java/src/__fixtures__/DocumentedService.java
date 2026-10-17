package com.example.service;

/** Combines values for callers. */
public class DocumentedService {
    /**
     * Creates the service.
     * @param repository where the values are stored
     */
    public DocumentedService(String repository) {
    }

    /**
     * Adds two numbers.
     * @param a the first addend
     * @param b the second addend - added to the first
     * @param ghost documents a parameter that does not exist
     * @return the sum
     */
    public int add(int a, int b) {
        return a + b;
    }

    /**
     * Joins values.
     * @param parts the parts to join
     */
    public String join(String... parts) {
        return String.join(",", parts);
    }

    public int undocumented(int x) {
        return x;
    }
}
