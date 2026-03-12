-- CreateTable
CREATE TABLE `TierListVote` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `classKey` VARCHAR(191) NOT NULL,
    `tier` ENUM('S', 'A', 'B', 'C', 'D', 'E') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TierListVote_classKey_idx`(`classKey`),
    UNIQUE INDEX `TierListVote_userId_classKey_key`(`userId`, `classKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TierListVote` ADD CONSTRAINT `TierListVote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
