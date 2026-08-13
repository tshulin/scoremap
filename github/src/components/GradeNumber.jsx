// GradeNumber - animated grade figures, matching the original GradeCompass:
// NumberFlow digits spin up/down when a value changes (hypothetical edits,
// refreshes), 400ms with NumberFlow's signature ease-out curve, which
// GradeCompass pins explicitly and we mirror here.
import React from 'react';
import NumberFlow from '@number-flow/react';

// https://github.com/barvian/number-flow - the library's default linear()
// spring approximation, same constant GradeCompass exports.
export const numberFlowEasing =
  'linear(0,.005,.019,.039,.066,.096,.129,.165,.202,.24,.278,.316,.354,.39,.426,.461,.494,.526,.557,.586,.614,.64,.665,.689,.711,.731,.751,.769,.786,.802,.817,.831,.844,.856,.867,.877,.887,.896,.904,.912,.919,.925,.931,.937,.942,.947,.951,.955,.959,.962,.965,.968,.971,.973,.976,.978,.98,.981,.983,.984,.986,.987,.988,.989,.99,.991,.992,.992,.993,.994,.994,.995,.995,.996,.996,.9963,.9967,.9969,.9972,.9975,.9977,.9979,.9981,.9982,.9984,.9985,.9987,.9988,.9989,1)';

export const spinTiming = { duration: 400, easing: numberFlowEasing };

// "B 85.03%": letter goes in `prefix`, the number animates, "%" (or "/20")
// rides along as `suffix`. Values render exactly like the fmt2 strings they
// replace (up to 2 decimals, no trailing zeros).
function GradeNumber({ value, prefix, suffix = '%', digits = 2, style }) {
  return (
    <NumberFlow
      value={value}
      prefix={prefix}
      suffix={suffix}
      format={{ maximumFractionDigits: digits }}
      spinTiming={spinTiming}
      transformTiming={spinTiming}
      style={style}
    />
  );
}

export default GradeNumber;
