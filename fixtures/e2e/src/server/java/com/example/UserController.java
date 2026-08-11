package com.example;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** HTTP endpoints for fixture users. */
@RestController
@RequestMapping("/api/users")
public class UserController {
    /** Returns one user identifier. */
    @GetMapping("/{id}")
    public String getUser(@PathVariable String id) {
        return id;
    }
}
