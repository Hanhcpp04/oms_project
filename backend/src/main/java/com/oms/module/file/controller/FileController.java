package com.oms.module.file.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.module.file.service.FileService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final FileService fileService;

    @PostMapping("/upload")
    public ApiResponse<String> upload(@RequestParam("file") MultipartFile file) {
        String fileUrl = fileService.uploadFile(file);
        return ApiResponse.ok("Upload thành công", fileUrl);
    }

    @GetMapping("/display/{fileName:.+}")
    public ResponseEntity<Resource> displayFile(@PathVariable String fileName) {
        FileService.StoredFile storedFile = fileService.loadFile(fileName);
        return ResponseEntity.ok()
                .contentType(storedFile.mediaType())
                .contentLength(storedFile.contentLength())
                .body(storedFile.resource());
    }
}
