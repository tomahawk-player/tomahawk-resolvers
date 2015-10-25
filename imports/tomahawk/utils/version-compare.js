/**
 * Compares versions strings
 * (version1 < version2) == -1
 * (version1 = version2) == 0
 * (version1 > version2) == 1
 */
export default function versionCompare(version1, version2) {
    var v1 = version1.split('.').map(function (item) {
        return parseInt(item);
    });
    var v2 = version2.split('.').map(function (item) {
        return parseInt(item);
    });
    var length = Math.max(v1.length, v2.length);
    var i = 0;

    for (; i < length; i++) {
        if (typeof v1[i] == "undefined" || v1[i] === null) {
            if (typeof v2[i] == "undefined" || v2[i] === null) {
                // v1 == v2
                return 0;
            } else if (v2[i] === 0) {
                continue;
            } else {
                // v1 < v2
                return -1;
            }
        } else if (typeof v2[i] == "undefined" || v2[i] === null) {
            if (v1[i] === 0) {
                continue;
            } else {
                // v1 > v2
                return 1;
            }
        } else if (v2[i] > v1[i]) {
            // v1 < v2
            return -1;
        } else if (v2[i] < v1[i]) {
            // v1 > v2
            return 1;
        }
    }
    // v1 == v2
    return 0;
};

/**
 * Check if this is at least specified tomahawk-api-version.
 */
export function atLeastVersion(version) {
    return (versionCompare(Tomahawk.apiVersion, version) >= 0);
};
