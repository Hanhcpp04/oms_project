package com.oms.module.product.controller;

import org.springframework.web.bind.annotation.*;
import com.oms.common.exception.GlobalExceptionHandler;
import java.io.*;

@RestController
@RequestMapping("/api/test-error")
public class TestController {
    @GetMapping
    public String getError() {
        if (GlobalExceptionHandler.lastException == null) return "No error captured yet.";
        StringWriter sw = new StringWriter();
        GlobalExceptionHandler.lastException.printStackTrace(new PrintWriter(sw));
        return sw.toString();
    }
}
