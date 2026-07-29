package com.example.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** User REST endpoints. */
@RestController
@RequestMapping("/api/users")
public class UserController {
    /**
     * Finds a user.
     *
     * @param id user identifier
     * @param verbose include verbose fields
     * @return matching user
     */
    @GetMapping("/{id}")
    public ResponseEntity<UserDto> getUser(
        @PathVariable("id") String id,
        @RequestParam(name = "verbose", required = false, defaultValue = "false") boolean verbose
    ) {
        return null;
    }

    /** Creates a user. */
    @PostMapping
    public UserDto create(@RequestBody CreateUserRequest request) {
        return null;
    }
}
