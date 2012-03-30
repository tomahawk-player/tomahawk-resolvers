/* === This file is part of Tomahawk Player - <http://tomahawk-player.org> ===
 *
 *   Copyright 2010-2012, Leo Franchi <lfranchi@kde.org>
 *
 *   Inspired by Clementine's Closure class
 *
 *   Tomahawk is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   Tomahawk is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with Tomahawk. If not, see <http://www.gnu.org/licenses/>.
 */

#include "PlaylistClosure.h"

#include <QDebug>

PlaylistClosure::PlaylistClosure(LoadedCondition condition,
                 QObject* receiver,
                 const char* slot,
                 const ClosureArgumentWrapper* val0,
                 const ClosureArgumentWrapper* val1,
                 const ClosureArgumentWrapper* val2)
      : condition_(condition)
      , receiver_(receiver)
      , val0_(val0)
      , val1_(val1)
      , val2_(val2)

{
  const QMetaObject* meta_receiver = receiver->metaObject();

  QByteArray normalised_slot = QMetaObject::normalizedSignature(slot + 1);
  const int index = meta_receiver->indexOfSlot(normalised_slot.constData());
  Q_ASSERT(index != -1);
  slot_ = meta_receiver->method(index);
}

bool
PlaylistClosure::conditionSatisfied() const
{
    return condition_();
}

void
PlaylistClosure::invoke()
{
//     qDebug() << val0_->arg().name() << val0_->arg().data();
//     qDebug() << val1_->arg().name() << val1_->arg().data();
//     qDebug() << val2_->arg().name() << val2_->arg().data();
    slot_.invoke(receiver_,
        val0_ ? val0_->arg() : QGenericArgument(),
        val1_ ? val1_->arg() : QGenericArgument(),
        val2_ ? val2_->arg() : QGenericArgument());
}
