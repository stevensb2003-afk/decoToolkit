import * as ClipperLib from 'clipper-lib';

export const simplifyPaths = (paths: ClipperLib.Paths): ClipperLib.Paths => {
    const clipper = new ClipperLib.Clipper();
    // @ts-ignore
    // clipper.StrictlySimple = true;
    clipper.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
    const result: ClipperLib.Paths = [];
    clipper.Execute(ClipperLib.ClipType.ctUnion, result, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
    return result;
};
