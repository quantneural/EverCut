# Photo Gallery Remediation Log

Date: 2026-03-10

## Scope

This document records only the changes made for the Photo Gallery area and its direct dependencies after reviewing `/Users/prankitapotbhare/Projects/EverCut/server/docs/TECHNICAL_AUDIT_2026-03-09.md`.

Primary focus files from the audit:

- `/Users/prankitapotbhare/Projects/EverCut/server/src/routes/barber.routes.js`
- `/Users/prankitapotbhare/Projects/EverCut/server/src/controllers/barber/barber-photo.controller.js`
- `/Users/prankitapotbhare/Projects/EverCut/server/src/services/photo.service.js`
- `/Users/prankitapotbhare/Projects/EverCut/server/src/repositories/photo.repository.js`
- `/Users/prankitapotbhare/Projects/EverCut/server/src/models/photo.model.js`
- `/Users/prankitapotbhare/Projects/EverCut/server/src/validators/photo.validator.js`
- `/Users/prankitapotbhare/Projects/EverCut/server/src/middleware/upload.middleware.js`

## Verification Performed

- Parsed all JavaScript files after the changes:
  - `find src scripts -name '*.js' -print0 | xargs -0 -n1 node --check`
- Result: syntax verification passed.

## Audit Findings Addressed

### PG-01 - Uploads validated after Cloudinary upload and not rolled back on failure

Status: fixed

Changes:
- Added `/Users/prankitapotbhare/Projects/EverCut/server/src/utils/cloudinary-cleanup.utils.js`
- Updated `/Users/prankitapotbhare/Projects/EverCut/server/src/middleware/validate.middleware.js`
- Updated `/Users/prankitapotbhare/Projects/EverCut/server/src/services/photo.service.js`

Previous implementation:
- `uploadShopPhotos` uploaded files to Cloudinary first.
- `photoUploadSchema` validation ran only after the upload completed.
- If validation failed, or if the later service layer failed, the request returned an error but the Cloudinary assets could remain orphaned.
- Cover-image uploads had the same failure pattern if the later DB update failed.

What was updated:
- Added `/Users/prankitapotbhare/Projects/EverCut/server/src/utils/cloudinary-cleanup.utils.js` to centralize rollback of uploaded Cloudinary assets.
- Updated `/Users/prankitapotbhare/Projects/EverCut/server/src/middleware/validate.middleware.js` so validation failures now trigger Cloudinary cleanup for `req.file` / `req.files`.
- Updated `/Users/prankitapotbhare/Projects/EverCut/server/src/services/photo.service.js` so service-level failures also clean up uploaded files.
- Applied the same cleanup pattern to cover-image update failures.

Why it was updated:
- To remove orphaned Cloudinary assets created by failed requests.
- To keep the gallery and storage layer consistent when validation or persistence fails after upload.
- To reduce storage leakage and operational cleanup work.

### PG-02 - Photo limit enforcement not atomic and leaves orphaned assets under failure/concurrency

Status: fixed

Changes:
- Updated `/Users/prankitapotbhare/Projects/EverCut/server/src/models/shop.model.js`
- Updated `/Users/prankitapotbhare/Projects/EverCut/server/src/repositories/shop.repository.js`
- Updated `/Users/prankitapotbhare/Projects/EverCut/server/src/repositories/photo.repository.js`
- Updated `/Users/prankitapotbhare/Projects/EverCut/server/src/services/photo.service.js`

Previous implementation:
- Upload quota was enforced by reading `photoRepository.getActiveCountByShop(shop._id)` and comparing that value with `files.length`.
- After that check passed, the service inserted photo rows one by one.
- Under concurrent requests, two uploads could read the same count and both pass the limit check.
- If a later insert failed, previously uploaded Cloudinary files could remain even though the request failed.

What was updated:
- Added `galleryPhotoCount` to `/Users/prankitapotbhare/Projects/EverCut/server/src/models/shop.model.js`.
- Added `incrementGalleryPhotoCount()` to `/Users/prankitapotbhare/Projects/EverCut/server/src/repositories/shop.repository.js` for atomic reservation.
- Added bulk photo creation support in `/Users/prankitapotbhare/Projects/EverCut/server/src/repositories/photo.repository.js`.
- Reworked `/Users/prankitapotbhare/Projects/EverCut/server/src/services/photo.service.js` so gallery uploads now:
  - backfill missing shop counts once
  - reserve photo capacity inside a MongoDB transaction
  - insert photo metadata in bulk inside the same transaction
  - clean up Cloudinary uploads if the transaction fails

Why it was updated:
- To close the race condition around gallery limits.
- To stop partial writes where storage upload succeeds but DB persistence fails.
- To ensure the quota check and the metadata write behave as one logical operation.

### PG-03 - Delete removes DB record before Cloudinary cleanup and suppresses failures

Status: fixed

Changes:
- Updated `/Users/prankitapotbhare/Projects/EverCut/server/src/models/photo.model.js`
- Updated `/Users/prankitapotbhare/Projects/EverCut/server/src/repositories/photo.repository.js`
- Updated `/Users/prankitapotbhare/Projects/EverCut/server/src/services/photo.service.js`
- Updated `/Users/prankitapotbhare/Projects/EverCut/server/src/utils/api-error.js`

Previous implementation:
- `deletePhoto()` deleted the database record first by calling `photoRepository.deleteByIdAndShop(...)`.
- It then attempted `cloudinary.uploader.destroy(...)`.
- Cloudinary failures were swallowed in an empty `catch`, and the endpoint still reported success.
- Because the DB row was already gone, the system lost the metadata needed for a safe retry.

What was updated:
- Added `deletedAt` to `/Users/prankitapotbhare/Projects/EverCut/server/src/models/photo.model.js`.
- Replaced hard delete with soft delete in `/Users/prankitapotbhare/Projects/EverCut/server/src/repositories/photo.repository.js`.
- Added `ExternalServiceError` in `/Users/prankitapotbhare/Projects/EverCut/server/src/utils/api-error.js`.
- Reworked `/Users/prankitapotbhare/Projects/EverCut/server/src/services/photo.service.js` so deletion now:
  - checks and normalizes gallery count first
  - deletes the Cloudinary asset first
  - throws a 502-style error if storage deletion fails
  - soft-deletes the photo metadata only after storage deletion succeeds
  - decrements `galleryPhotoCount` transactionally
  - logs rare post-storage metadata failures

Why it was updated:
- To stop returning false success when Cloudinary deletion fails.
- To preserve a consistent delete contract for the Photo Gallery API.
- To align photo deletion with the rest of the system's soft-delete pattern.

### PG-04 - Invalid file types surface as 500 instead of a clean 4xx

Status: fixed

Changes:
- Updated `/Users/prankitapotbhare/Projects/EverCut/server/src/middleware/upload.middleware.js`

Previous implementation:
- `imageFilter()` called `cb(new Error(...), false)` for invalid mime types.
- The global error handler only had explicit handling for `MulterError` and `AppError`.
- Invalid file uploads therefore fell through the generic error path and behaved like server errors.

What was updated:
- `/Users/prankitapotbhare/Projects/EverCut/server/src/middleware/upload.middleware.js` now raises `BadRequestError` directly from the file filter.

Why it was updated:
- To classify invalid uploads as client errors, not server failures.
- To give the Photo Gallery API deterministic 400-class behavior for invalid image uploads.

### PG-05 - Photo model/repository deletion strategy inconsistent with soft-delete design

Status: fixed

Changes:
- Updated `/Users/prankitapotbhare/Projects/EverCut/server/src/models/photo.model.js`
- Updated `/Users/prankitapotbhare/Projects/EverCut/server/src/repositories/photo.repository.js`
- Updated `/Users/prankitapotbhare/Projects/EverCut/server/src/services/photo.service.js`

Previous implementation:
- The `Photo` model already had `isActive`, which suggested soft-delete semantics.
- Despite that, the repository physically deleted rows with `findOneAndDelete(...)`.
- That made photo deletion inconsistent with the rest of the codebase and reduced auditability.

What was updated:
- `Photo` now stores `deletedAt`.
- The repository now soft-deletes photos instead of physically deleting them.
- Normal gallery/stat reads still filter on `isActive: true`, so deleted records stay hidden from the active gallery.

Why it was updated:
- To make the photo lifecycle consistent with the existing domain design.
- To preserve recoverability and auditability for deleted photo metadata.

## Additional Photo-Related Improvements

### Cover image lifecycle hardening

Files:
- `/Users/prankitapotbhare/Projects/EverCut/server/src/services/photo.service.js`

Changes:
- If the barber has no shop profile, newly uploaded cover images are now cleaned up before the request fails.
- If the DB update fails, the new cover image upload is deleted.
- Old cover-image cleanup failures are now logged instead of being silently swallowed.

Previous implementation:
- Cover updates assumed the shop row existed and did not clean up the newly uploaded asset if the DB update failed.
- Old cover-image delete failures were silently swallowed.

What was updated:
- The cover-update path now cleans up the new upload if shop lookup or DB persistence fails.
- Old cover-image cleanup failures are logged with context.

Why it was updated:
- Cover images use the same external-storage lifecycle as the Photo Gallery.
- The same failure patterns that affected gallery photos also affected cover images.

### Photo upload response envelope consistency

Files:
- `/Users/prankitapotbhare/Projects/EverCut/server/src/controllers/barber/barber-photo.controller.js`

Changes:
- Successful gallery upload responses now return `ApiResponse.success(..., ..., 201)` so the JSON envelope matches the HTTP status code.

Previous implementation:
- The HTTP response status was `201`, but the JSON response body still defaulted to `statusCode: 200`.

What was updated:
- `/Users/prankitapotbhare/Projects/EverCut/server/src/controllers/barber/barber-photo.controller.js` now passes `201` into `ApiResponse.success(...)`.

Why it was updated:
- To keep the Photo Gallery response envelope internally consistent for API consumers.

## Files Changed

### New files

- `/Users/prankitapotbhare/Projects/EverCut/server/src/utils/cloudinary-cleanup.utils.js`

### Updated files

- `/Users/prankitapotbhare/Projects/EverCut/server/src/controllers/barber/barber-photo.controller.js`
- `/Users/prankitapotbhare/Projects/EverCut/server/src/middleware/upload.middleware.js`
- `/Users/prankitapotbhare/Projects/EverCut/server/src/middleware/validate.middleware.js`
- `/Users/prankitapotbhare/Projects/EverCut/server/src/models/photo.model.js`
- `/Users/prankitapotbhare/Projects/EverCut/server/src/models/shop.model.js`
- `/Users/prankitapotbhare/Projects/EverCut/server/src/repositories/photo.repository.js`
- `/Users/prankitapotbhare/Projects/EverCut/server/src/repositories/shop.repository.js`
- `/Users/prankitapotbhare/Projects/EverCut/server/src/services/photo.service.js`
- `/Users/prankitapotbhare/Projects/EverCut/server/src/utils/api-error.js`

## Residual Notes

- The gallery flow is now substantially safer and more consistent, but there is still no asynchronous retry/outbox worker for rare cases where Cloudinary deletion succeeds and a later DB step fails.
- No non-photo business logic was changed in this remediation pass.
