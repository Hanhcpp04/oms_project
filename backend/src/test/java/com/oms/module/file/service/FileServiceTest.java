package com.oms.module.file.service;

import com.oms.common.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FileServiceTest {

    @TempDir
    Path uploadDir;

    private FileService fileService;

    @BeforeEach
    void setUp() {
        fileService = new FileService();
        ReflectionTestUtils.setField(fileService, "uploadDir", uploadDir.toString());
    }

    @Test
    void shouldStoreAndLoadAllowedImage() throws Exception {
        byte[] png = new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3};
        var file = new MockMultipartFile("file", "logo.png", "image/png", png);

        String url = fileService.uploadFile(file);
        String fileName = url.substring(url.lastIndexOf('/') + 1);
        FileService.StoredFile storedFile = fileService.loadFile(fileName);

        assertThat(storedFile.mediaType().toString()).isEqualTo("image/png");
        assertThat(storedFile.resource().contentLength()).isEqualTo(png.length);
    }

    @Test
    void shouldRejectUnsupportedFileType() {
        var file = new MockMultipartFile("file", "payload.svg", "image/svg+xml", "<svg/>".getBytes());

        assertThatThrownBy(() -> fileService.uploadFile(file))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Only PNG, JPEG and WebP");
    }

    @Test
    void shouldRejectPathTraversal() {
        assertThatThrownBy(() -> fileService.loadFile("../secret.png"))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Invalid file name");
    }

    @Test
    void shouldRejectSpoofedImageContent() {
        var file = new MockMultipartFile("file", "payload.png", "image/png", "not-an-image".getBytes());

        assertThatThrownBy(() -> fileService.uploadFile(file))
                .isInstanceOf(BusinessException.class)
                .hasMessage("File content does not match its image type");
    }
}
