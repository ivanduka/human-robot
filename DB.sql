-- MySQL dump 10.13  Distrib 8.0.19, for Win64 (x86_64)
--
-- Host: localhost    Database: pcmr
-- ------------------------------------------------------
-- Server version	8.0.19

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `csvs`
--

DROP TABLE IF EXISTS `csvs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `csvs` (
  `csvId` varchar(36) NOT NULL,
  `tableId` varchar(36) NOT NULL,
  `method` varchar(255) NOT NULL,
  `status` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`csvId`),
  UNIQUE KEY `uuid_UNIQUE` (`csvId`),
  KEY `table_idx` (`tableId`),
  CONSTRAINT `table` FOREIGN KEY (`tableId`) REFERENCES `tables` (`tableId`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pdfs`
--

DROP TABLE IF EXISTS `pdfs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pdfs` (
  `pdfId` int NOT NULL,
  `pdfName` varchar(255) NOT NULL,
  `pdfSize` double NOT NULL,
  `filingId` int NOT NULL,
  `date` date NOT NULL,
  `totalPages` int NOT NULL,
  `status` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`pdfId`,`pdfName`),
  UNIQUE KEY `fileId_UNIQUE` (`pdfId`),
  UNIQUE KEY `fileName_UNIQUE` (`pdfName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tables`
--

DROP TABLE IF EXISTS `tables`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tables` (
  `tableId` varchar(36) NOT NULL,
  `pdfId` int NOT NULL,
  `page` int NOT NULL,
  `pageWidth` int NOT NULL,
  `pageHeight` int NOT NULL,
  `x1` int NOT NULL,
  `y1` int NOT NULL,
  `x2` int NOT NULL,
  `y2` int NOT NULL,
  `tableTitle` mediumtext NOT NULL,
  `continuationOf` varchar(36) DEFAULT NULL,
  `pdfWidth` int DEFAULT NULL,
  `pdfHeight` int DEFAULT NULL,
  `pdfX1` int DEFAULT NULL,
  `pdfY1` int DEFAULT NULL,
  `pdfX2` int DEFAULT NULL,
  `pdfY2` int DEFAULT NULL,
  `tablescol` varchar(36) DEFAULT NULL,
  `correctCsv` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`tableId`),
  UNIQUE KEY `uuid_UNIQUE` (`tableId`),
  KEY `pdf_idx` (`pdfId`),
  KEY `continuation_idx` (`continuationOf`),
  KEY `correct_csv_idx` (`correctCsv`),
  CONSTRAINT `continuation` FOREIGN KEY (`continuationOf`) REFERENCES `tables` (`tableId`),
  CONSTRAINT `correct_csv` FOREIGN KEY (`correctCsv`) REFERENCES `csvs` (`csvId`),
  CONSTRAINT `pdf` FOREIGN KEY (`pdfId`) REFERENCES `pdfs` (`pdfId`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2020-03-21 14:40:01
