# LSM Storage Engine Test Results\n\nDate: 2026-02-02\n
\n## Phase 1: Basic Correctness Tests\n\n
{
  "phase": "phase1",
  "writeSuccess": 100,
  "readSuccess": 100,
  "verifySuccess": 100,
  "mismatches": []
}
\n## Phase 2: MemTable Flush & SSTable Verification\n\n
{
  "phase": "phase2_write",
  "totalWritten": 300,
  "flushLogs": [
    {
      "batch": 1,
      "totalWritten": 50,
      "levels": [
        {
          "level": 1,
          "fileCount": 1,
          "totalSize": 632,
          "files": [
            "level_1_1770024937669.json"
          ]
        }
      ],
      "isCompacting": false
    },
    {
      "batch": 2,
      "totalWritten": 100,
      "levels": [
        {
          "level": 0,
          "fileCount": 1,
          "totalSize": 365,
          "files": [
            "level_0_1770024938273.json"
          ]
        },
        {
          "level": 1,
          "fileCount": 1,
          "totalSize": 632,
          "files": [
            "level_1_1770024937669.json"
          ]
        }
      ],
      "isCompacting": false
    },
    {
      "batch": 3,
      "totalWritten": 150,
      "levels": [
        {
          "level": 0,
          "fileCount": 2,
          "totalSize": 739,
          "files": [
            "level_0_1770024938273.json",
            "level_0_1770024938883.json"
          ]
        },
        {
          "level": 1,
          "fileCount": 1,
          "totalSize": 632,
          "files": [
            "level_1_1770024937669.json"
          ]
        }
      ],
      "isCompacting": false
    },
    {
      "batch": 4,
      "totalWritten": 200,
      "levels": [
        {
          "level": 0,
          "fileCount": 3,
          "totalSize": 1106,
          "files": [
            "level_0_1770024938273.json",
            "level_0_1770024938883.json",
            "level_0_1770024939314.json"
          ]
        },
        {
          "level": 1,
          "fileCount": 1,
          "totalSize": 632,
          "files": [
            "level_1_1770024937669.json"
          ]
        }
      ],
      "isCompacting": false
    },
    {
      "batch": 5,
      "totalWritten": 250,
      "levels": [
        {
          "level": 1,
          "fileCount": 2,
          "totalSize": 1803,
          "files": [
            "level_1_1770024937669.json",
            "level_1_1770024939851.json"
          ]
        }
      ],
      "isCompacting": false
    },
    {
      "batch": 6,
      "totalWritten": 300,
      "levels": [
        {
          "level": 0,
          "fileCount": 1,
          "totalSize": 366,
          "files": [
            "level_0_1770024940335.json"
          ]
        },
        {
          "level": 1,
          "fileCount": 2,
          "totalSize": 1803,
          "files": [
            "level_1_1770024937669.json",
            "level_1_1770024939851.json"
          ]
        }
      ],
      "isCompacting": false
    }
  ]
}
\n
{
  "phase": "phase2_verify",
  "totalChecked": 300,
  "missing": 0,
  "missingKeys": []
}
\n## Phase 3: Compaction Correctness\n\n
{
  "phase": "phase3",
  "totalWritten": 240,
  "deletedCount": 20,
  "compactionStarted": false,
  "finalLevels": [
    {
      "level": 0,
      "fileCount": 1,
      "totalSize": 374,
      "files": [
        "level_0_1770025039733.json"
      ]
    },
    {
      "level": 1,
      "fileCount": 1,
      "totalSize": 1137,
      "files": [
        "level_1_1770025039609.json"
      ]
    }
  ],
  "readErrorsDuringCompaction": [],
  "missingOrIncorrect": [],
  "duplicateKeysInScan": [],
  "scanCount": 220
}
\n## Phase 4: Bloom Filter Effectiveness\n\n
{
  "phase": "phase4",
  "bloomStats": {
    "before": {
      "hits": 0,
      "misses": 655
    },
    "afterExisting": {
      "hits": 0,
      "misses": 1120
    },
    "afterMissing": {
      "hits": 0,
      "misses": 1120
    }
  },
  "deltas": {
    "existing": {
      "hits": 0,
      "misses": 465,
      "efficiencyPct": 0
    },
    "missing": {
      "hits": 0,
      "misses": 0,
      "efficiencyPct": 0
    }
  }
}
\n## Phase 5: Concurrency & Race Conditions\n\n
{
  "phase": "phase5",
  "writeErrors": [],
  "readErrors": [],
  "missingKeys": []
}
\n## Phase 7: Negative & Edge Case Tests\n\n
{
  "phase": "phase7",
  "results": {
    "emptyKey": {
      "status": 400,
      "data": {
        "message": "Key is required",
        "field": "key"
      }
    },
    "largeValuePut": {
      "status": 413,
      "data": {
        "message": "request entity too large"
      }
    },
    "largeValueGet": {
      "status": 200,
      "data": {
        "key": "p7_large",
        "value": null,
        "found": false
      }
    },
    "largeValueLength": 0,
    "unicodePut": {
      "status": 200,
      "data": {
        "success": true
      }
    },
    "unicodeGet": {
      "status": 200,
      "data": {
        "key": "????--??",
        "value": "unicode_val",
        "found": true
      }
    },
    "hotKeyFinal": {
      "status": 200,
      "data": {
        "key": "p7_hot",
        "value": "hot_19",
        "found": true
      }
    },
    "scanEmpty": {
      "status": 200,
      "data": {
        "results": [
          {
            "key": "????--??",
            "value": "unicode_val"
          },
          {
            "key": "p6c_k_0000",
            "value": "p6_val_0"
          },
          {
            "key": "p6c_k_0001",
            "value": "p6_val_1"
          },
          {
            "key": "p6c_k_0002",
            "value": "p6_val_2"
          },
          {
            "key": "p6c_k_0003",
            "value": "p6_val_3"
          },
          {
            "key": "p6c_k_0004",
            "value": "p6_val_4"
          },
          {
            "key": "p6c_k_0005",
            "value": "p6_val_5"
          },
          {
            "key": "p6c_k_0006",
            "value": "p6_val_6"
          },
          {
            "key": "p6c_k_0007",
            "value": "p6_val_7"
          },
          {
            "key": "p6c_k_0008",
            "value": "p6_val_8"
          },
          {
            "key": "p6c_k_0009",
            "value": "p6_val_9"
          },
          {
            "key": "p6c_k_0010",
            "value": "p6_val_10"
          },
          {
            "key": "p6c_k_0011",
            "value": "p6_val_11"
          },
          {
            "key": "p6c_k_0012",
            "value": "p6_val_12"
          },
          {
            "key": "p6c_k_0013",
            "value": "p6_val_13"
          },
          {
            "key": "p6c_k_0014",
            "value": "p6_val_14"
          },
          {
            "key": "p6c_k_0015",
            "value": "p6_val_15"
          },
          {
            "key": "p6c_k_0016",
            "value": "p6_val_16"
          },
          {
            "key": "p6c_k_0017",
            "value": "p6_val_17"
          },
          {
            "key": "p6c_k_0018",
            "value": "p6_val_18"
          },
          {
            "key": "p6c_k_0019",
            "value": "p6_val_19"
          },
          {
            "key": "p6c_k_0020",
            "value": "p6_val_20"
          },
          {
            "key": "p6c_k_0021",
            "value": "p6_val_21"
          },
          {
            "key": "p6c_k_0022",
            "value": "p6_val_22"
          },
          {
            "key": "p6c_k_0023",
            "value": "p6_val_23"
          },
          {
            "key": "p6c_k_0024",
            "value": "p6_val_24"
          },
          {
            "key": "p6c_k_0025",
            "value": "p6_val_25"
          },
          {
            "key": "p6c_k_0026",
            "value": "p6_val_26"
          },
          {
            "key": "p6c_k_0027",
            "value": "p6_val_27"
          },
          {
            "key": "p6c_k_0028",
            "value": "p6_val_28"
          },
          {
            "key": "p6c_k_0029",
            "value": "p6_val_29"
          },
          {
            "key": "p6c_k_0030",
            "value": "p6_val_30"
          },
          {
            "key": "p6c_k_0031",
            "value": "p6_val_31"
          },
          {
            "key": "p6c_k_0032",
            "value": "p6_val_32"
          },
          {
            "key": "p6c_k_0033",
            "value": "p6_val_33"
          },
          {
            "key": "p6c_k_0034",
            "value": "p6_val_34"
          },
          {
            "key": "p6c_k_0035",
            "value": "p6_val_35"
          },
          {
            "key": "p6c_k_0036",
            "value": "p6_val_36"
          },
          {
            "key": "p6c_k_0037",
            "value": "p6_val_37"
          },
          {
            "key": "p6c_k_0038",
            "value": "p6_val_38"
          },
          {
            "key": "p6c_k_0039",
            "value": "p6_val_39"
          },
          {
            "key": "p6c_k_0040",
            "value": "p6_val_40"
          },
          {
            "key": "p6c_k_0041",
            "value": "p6_val_41"
          },
          {
            "key": "p6c_k_0042",
            "value": "p6_val_42"
          },
          {
            "key": "p6c_k_0043",
            "value": "p6_val_43"
          },
          {
            "key": "p6c_k_0044",
            "value": "p6_val_44"
          },
          {
            "key": "p6c_k_0045",
            "value": "p6_val_45"
          },
          {
            "key": "p6c_k_0046",
            "value": "p6_val_46"
          },
          {
            "key": "p6c_k_0047",
            "value": "p6_val_47"
          },
          {
            "key": "p6c_k_0048",
            "value": "p6_val_48"
          }
        ]
      }
    },
    "scanInvalidRange": {
      "status": 200,
      "data": {
        "results": []
      }
    }
  }
}
