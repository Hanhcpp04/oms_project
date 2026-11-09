package com.oms.module.file.service;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.common.exception.ResourceNotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

@Service
public class FileService {

    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;
    private static final Map<String, MediaType> ALLOWED_IMAGE_TYPES = Map.of(
            "png", MediaType.IMAGE_PNG,
            "jpg", MediaType.IMAGE_JPEG,
            "jpeg", MediaType.IMAGE_JPEG,
            "webp", MediaType.parseMediaType("image/webp")
    );

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @Value("${app.upload.storage:local}")
    private String storageType = "local";

    @Value("${app.upload.s3.bucket:}")
    private String s3Bucket;

    @Autowired(required = false)
    private S3Client s3Client;

    public String uploadFile(MultipartFile file) {
        validateUpload(file);

        String extension = getExtension(file.getOriginalFilename());
        String fileName = UUID.randomUUID() + "." + extension;
        if (isS3Storage()) {
            storeInS3(file, fileName, ALLOWED_IMAGE_TYPES.get(extension));
            return "/api/files/display/" + fileName;
        }

        Path uploadRoot = getUploadRoot();
        Path filePath = uploadRoot.resolve(fileName).normalize();
        ensureInsideUploadRoot(uploadRoot, filePath);

        try {
            Files.createDirectories(uploadRoot);
            try (var inputStream = file.getInputStream()) {
                Files.copy(inputStream, filePath, StandardCopyOption.REPLACE_EXISTING);
            }
            return "/api/files/display/" + fileName;
        } catch (IOException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not store uploaded file");
        }
    }

    public StoredFile loadFile(String fileName) {
        if (!StringUtils.hasText(fileName)
                || fileName.contains("..")
                || fileName.contains("/")
                || fileName.contains("\\")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Invalid file name");
        }

        String extension = getExtension(fileName);
        MediaType mediaType = ALLOWED_IMAGE_TYPES.get(extension);
        if (mediaType == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Unsupported file type");
        }

        if (isS3Storage()) {
            return loadFromS3(fileName, mediaType);
        }

        Path uploadRoot = getUploadRoot();
        Path filePath = uploadRoot.resolve(fileName).normalize();
        ensureInsideUploadRoot(uploadRoot, filePath);

        try {
            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists() || !resource.isReadable() || !Files.isRegularFile(filePath)) {
                throw new ResourceNotFoundException("File", "name", fileName);
            }
            return new StoredFile(resource, mediaType, resource.contentLength());
        } catch (IOException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not read stored file");
        }
    }

    private void validateUpload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "File is required");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "File must not exceed 10MB");
        }

        String extension = getExtension(file.getOriginalFilename());
        MediaType expectedType = ALLOWED_IMAGE_TYPES.get(extension);
        if (expectedType == null || !expectedType.toString().equalsIgnoreCase(file.getContentType())) {
            throw new BusinessException(
                    ErrorCode.VALIDATION_ERROR,
                    "Only PNG, JPEG and WebP images are allowed"
            );
        }
        if (!hasExpectedSignature(file, extension)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "File content does not match its image type");
        }
    }

    private boolean hasExpectedSignature(MultipartFile file, String extension) {
        try (var inputStream = file.getInputStream()) {
            byte[] header = inputStream.readNBytes(12);
            return switch (extension) {
                case "png" -> startsWith(header, new int[]{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A});
                case "jpg", "jpeg" -> startsWith(header, new int[]{0xFF, 0xD8, 0xFF});
                case "webp" -> startsWith(header, new int[]{0x52, 0x49, 0x46, 0x46})
                        && matchesAt(header, 8, new int[]{0x57, 0x45, 0x42, 0x50});
                default -> false;
            };
        } catch (IOException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Could not inspect uploaded file");
        }
    }

    private boolean startsWith(byte[] source, int[] signature) {
        return matchesAt(source, 0, signature);
    }

    private boolean matchesAt(byte[] source, int offset, int[] signature) {
        if (source.length < offset + signature.length) {
            return false;
        }
        for (int i = 0; i < signature.length; i++) {
            if ((source[offset + i] & 0xFF) != signature[i]) {
                return false;
            }
        }
        return true;
    }

    private String getExtension(String fileName) {
        String cleaned = StringUtils.cleanPath(fileName == null ? "" : fileName);
        int separator = cleaned.lastIndexOf('.');
        if (separator < 0 || separator == cleaned.length() - 1) {
            return "";
        }
        return cleaned.substring(separator + 1).toLowerCase(Locale.ROOT);
    }

    private Path getUploadRoot() {
        return Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    private boolean isS3Storage() {
        return "s3".equalsIgnoreCase(storageType);
    }

    private void storeInS3(MultipartFile file, String fileName, MediaType mediaType) {
        validateS3Configuration();
        try {
            byte[] content = file.getBytes();
            s3Client.putObject(PutObjectRequest.builder()
                            .bucket(s3Bucket)
                            .key(fileName)
                            .contentType(mediaType.toString())
                            .build(),
                    RequestBody.fromBytes(content));
        } catch (IOException | S3Exception ex) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not store uploaded file");
        }
    }

    private StoredFile loadFromS3(String fileName, MediaType mediaType) {
        validateS3Configuration();
        try {
            byte[] content = s3Client.getObjectAsBytes(GetObjectRequest.builder()
                            .bucket(s3Bucket)
                            .key(fileName)
                            .build())
                    .asByteArray();
            return new StoredFile(new ByteArrayResource(content), mediaType, content.length);
        } catch (NoSuchKeyException ex) {
            throw new ResourceNotFoundException("File", "name", fileName);
        } catch (S3Exception ex) {
            if (ex.statusCode() == 404) {
                throw new ResourceNotFoundException("File", "name", fileName);
            }
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not read stored file");
        }
    }

    private void validateS3Configuration() {
        if (s3Client == null || !StringUtils.hasText(s3Bucket)) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "S3 storage is not configured");
        }
    }

    private void ensureInsideUploadRoot(Path uploadRoot, Path filePath) {
        if (!filePath.startsWith(uploadRoot)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Invalid file path");
        }
    }

    public record StoredFile(Resource resource, MediaType mediaType, long contentLength) {
    }
}
