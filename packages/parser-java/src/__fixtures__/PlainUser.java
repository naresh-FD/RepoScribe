package com.example.model;

/**
 * Represents an application user.
 *
 * @since 1.0
 */
public class PlainUser {
    /** User identifier. */
    private final String id;

    /**
     * Creates a user.
     *
     * @param id unique user identifier
     */
    public PlainUser(String id) {
        this.id = id;
    }

    /**
     * Returns the user identifier.
     *
     * @return current identifier
     */
    public String getId() {
        return id;
    }
}
